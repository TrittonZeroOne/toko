package service

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	binderbyteWilayahHost = "http://api.binderbyte.com"
	binderbyteCostHost    = "https://api.binderbyte.com"
)

// BinderbyteAPIKey dari env BINDERBYTE_API_KEY
func BinderbyteAPIKey() string {
	return strings.TrimSpace(os.Getenv("BINDERBYTE_API_KEY"))
}

func BinderbyteOriginSlug() string {
	origin := strings.TrimSpace(strings.ToLower(os.Getenv("BINDERBYTE_ORIGIN")))
	origin = strings.ReplaceAll(origin, " ", "")
	origin = strings.Trim(origin, ",")
	return origin
}

type binderHTTP struct{ client *http.Client }

func newBinder() *binderHTTP {
	return &binderHTTP{client: &http.Client{Timeout: 25 * time.Second}}
}

type wilayahEnvelope struct {
	Result   bool            `json:"result"`
	Message  string          `json:"message"`
	Code     interface{}     `json:"code"`
	Messages string          `json:"messages"`
	Value    json.RawMessage `json:"value"`
}

func binderbyteCodeOK(v interface{}) bool {
	switch t := v.(type) {
	case nil:
		return false
	case string:
		return t == "200"
	case float64:
		return t == 200
	default:
		return fmt.Sprint(t) == "200"
	}
}

func (b *binderHTTP) wilayahGET(path string, q url.Values) ([]byte, error) {
	key := BinderbyteAPIKey()
	if key == "" {
		return nil, fmt.Errorf("BINDERBYTE_API_KEY belum diset")
	}
	if q == nil {
		q = url.Values{}
	}
	q.Set("api_key", key)
	reqURL := binderbyteWilayahHost + path + "?" + q.Encode()
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	res, err := b.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("binderbyte wilayah HTTP %d: %s", res.StatusCode, string(body))
	}
	var env wilayahEnvelope
	if err := json.Unmarshal(body, &env); err != nil {
		return nil, err
	}
	if !env.Result && !binderbyteCodeOK(env.Code) {
		msg := strings.TrimSpace(env.Message)
		if msg == "" {
			msg = strings.TrimSpace(env.Messages)
		}
		if msg == "" {
			msg = "response tidak berhasil"
		}
		return nil, fmt.Errorf("binderbyte: %s", msg)
	}
	return env.Value, nil
}

// GeoProvince / GeoCity / GeoDistrict / GeoSubdistrict dipakai JSON response ke frontend (nama field kompatibel UI lama).

type GeoProvince struct {
	ProvinceID string `json:"province_id"`
	Province   string `json:"province"`
}

type GeoCity struct {
	CityID   string `json:"city_id"`
	CityName string `json:"city_name"`
	Type     string `json:"type"`
}

type GeoDistrict struct {
	DistrictID   string `json:"district_id"`
	DistrictName string `json:"district_name"`
	ZipCode      string `json:"zip_code,omitempty"`
}

type GeoSubdistrict struct {
	SubdistrictID   string `json:"subdistrict_id"`
	SubdistrictName string `json:"subdistrict_name"`
	ZipCode         string `json:"zip_code,omitempty"`
}

func parseWilayahArray(raw []byte) ([]map[string]interface{}, error) {
	var rows []map[string]interface{}
	if len(raw) == 0 {
		return rows, nil
	}
	if err := json.Unmarshal(raw, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

func strID(v interface{}) string {
	if v == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(v))
}

// BinderbyteProvinces daftar provinsi.
func BinderbyteProvinces() ([]GeoProvince, error) {
	var raw []byte
	var err error
	for _, p := range []string{"/wilayah/provinsi", "/wilayah/povinsi"} {
		raw, err = newBinder().wilayahGET(p, nil)
		if err == nil {
			break
		}
	}
	if err != nil {
		return nil, err
	}
	rows, err := parseWilayahArray(raw)
	if err != nil {
		return nil, err
	}
	var out []GeoProvince
	for _, m := range rows {
		id := strID(m["id"])
		name := strID(m["name"])
		if id == "" {
			continue
		}
		out = append(out, GeoProvince{ProvinceID: id, Province: name})
	}
	return out, nil
}

// BinderbyteCities kab/kota per provinsi (filter id_provinsi jika API mendukung; jika tidak, filter di memori).
func BinderbyteCities(provinceID string) ([]GeoCity, error) {
	pid := strings.TrimSpace(provinceID)
	if pid == "" {
		return nil, fmt.Errorf("province_id wajib")
	}
	q := url.Values{}
	q.Set("id_provinsi", pid)
	raw, err := newBinder().wilayahGET("/wilayah/kabupaten", q)
	if err != nil {
		return nil, err
	}
	rows, err := parseWilayahArray(raw)
	if err != nil {
		return nil, err
	}
	out := filterKabupatenRows(rows, pid)
	if len(out) == 0 {
		rawAll, errAll := newBinder().wilayahGET("/wilayah/kabupaten", url.Values{})
		if errAll == nil {
			if rowsAll, e := parseWilayahArray(rawAll); e == nil {
				out = filterKabupatenRows(rowsAll, pid)
			}
		}
	}
	return out, nil
}

func filterKabupatenRows(rows []map[string]interface{}, pid string) []GeoCity {
	var out []GeoCity
	for _, m := range rows {
		if strID(m["id_provinsi"]) != pid {
			continue
		}
		id := strID(m["id"])
		name := strID(m["name"])
		if id == "" {
			continue
		}
		out = append(out, GeoCity{CityID: id, CityName: name, Type: ""})
	}
	return out
}

// BinderbyteDistricts kecamatan per kab/kota.
func BinderbyteDistricts(cityID string) ([]GeoDistrict, error) {
	cid := strings.TrimSpace(cityID)
	if cid == "" {
		return nil, fmt.Errorf("city_id wajib")
	}
	q := url.Values{}
	q.Set("id_kabupaten", cid)
	raw, err := newBinder().wilayahGET("/wilayah/kecamatan", q)
	if err != nil {
		return nil, err
	}
	rows, err := parseWilayahArray(raw)
	if err != nil {
		return nil, err
	}
	out := filterKecamatanRows(rows, cid)
	if len(out) == 0 {
		rawAll, errAll := newBinder().wilayahGET("/wilayah/kecamatan", url.Values{})
		if errAll == nil {
			if rowsAll, e := parseWilayahArray(rawAll); e == nil {
				out = filterKecamatanRows(rowsAll, cid)
			}
		}
	}
	return out, nil
}

func filterKecamatanRows(rows []map[string]interface{}, cid string) []GeoDistrict {
	var out []GeoDistrict
	for _, m := range rows {
		if strID(m["id_kabupaten"]) != cid {
			continue
		}
		id := strID(m["id"])
		name := strID(m["name"])
		if id == "" {
			continue
		}
		out = append(out, GeoDistrict{DistrictID: id, DistrictName: name})
	}
	return out
}

// BinderbyteSubdistricts kelurahan per kecamatan.
func BinderbyteSubdistricts(districtID string) ([]GeoSubdistrict, error) {
	did := strings.TrimSpace(districtID)
	if did == "" {
		return nil, fmt.Errorf("district_id wajib")
	}
	q := url.Values{}
	q.Set("id_kecamatan", did)
	raw, err := newBinder().wilayahGET("/wilayah/kelurahan", q)
	if err != nil {
		return nil, err
	}
	rows, err := parseWilayahArray(raw)
	if err != nil {
		return nil, err
	}
	out := filterKelurahanRows(rows, did)
	if len(out) == 0 {
		rawAll, errAll := newBinder().wilayahGET("/wilayah/kelurahan", url.Values{})
		if errAll == nil {
			if rowsAll, e := parseWilayahArray(rawAll); e == nil {
				out = filterKelurahanRows(rowsAll, did)
			}
		}
	}
	return out, nil
}

func filterKelurahanRows(rows []map[string]interface{}, did string) []GeoSubdistrict {
	var out []GeoSubdistrict
	for _, m := range rows {
		if strID(m["id_kecamatan"]) != did {
			continue
		}
		id := strID(m["id"])
		name := strID(m["name"])
		if id == "" {
			continue
		}
		out = append(out, GeoSubdistrict{SubdistrictID: id, SubdistrictName: name})
	}
	return out
}

// ShippingQuote satu opsi ongkir untuk UI
type ShippingQuote struct {
	Courier     string `json:"courier"`
	CourierName string `json:"courier_name"`
	Service     string `json:"service"`
	Description string `json:"description"`
	Price       int64  `json:"price"`
	Etd         string `json:"etd"`
	Note        string `json:"note"`
}

type binderCostResp struct {
	Code    interface{} `json:"code"`
	Message string      `json:"message"`
	Data    struct {
		Results []struct {
			Code  string `json:"code"`
			Name  string `json:"name"`
			Costs []struct {
				Service     string  `json:"service"`
				Description string  `json:"description"`
				Cost        float64 `json:"cost"`
				Etd         string  `json:"etd"`
			} `json:"costs"`
		} `json:"results"`
	} `json:"data"`
}

func binderCostCodeOK(v interface{}) bool {
	switch t := v.(type) {
	case string:
		return t == "" || t == "200"
	case float64:
		return t == 200
	default:
		return true
	}
}

func binderCostNeedsFallback(status int, body []byte, parsedMessage string) bool {
	msg := strings.ToLower(strings.TrimSpace(parsedMessage))
	if msg == "" && len(body) > 0 {
		var p struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(body, &p) == nil {
			msg = strings.ToLower(strings.TrimSpace(p.Message))
		}
	}
	return status == http.StatusBadRequest && strings.Contains(msg, "invalid origin or destination prefix ids")
}

// BinderbyteShippingCost POST /v1/cost — origin dan destination berupa slug lokasi.
func BinderbyteShippingCost(originSlug, destinationSlug string, weightGram int, courier string) ([]ShippingQuote, error) {
	key := BinderbyteAPIKey()
	if key == "" {
		return nil, fmt.Errorf("BINDERBYTE_API_KEY belum diset")
	}
	originSlug = strings.TrimSpace(strings.ToLower(originSlug))
	destinationSlug = strings.TrimSpace(strings.ToLower(destinationSlug))
	if originSlug == "" || destinationSlug == "" {
		return nil, fmt.Errorf("origin dan destination kota wajib")
	}
	kg := float64(weightGram) / 1000.0
	if kg < 0.001 {
		kg = 0.001
	}
	if courier == "" {
		courier = "jne"
	}
	form := url.Values{}
	form.Set("api_key", key)
	form.Set("origin", originSlug)
	form.Set("destination", destinationSlug)
	form.Set("courier", courier)
	form.Set("weight", strconv.FormatFloat(kg, 'f', 3, 64))

	req, err := http.NewRequest(http.MethodPost, binderbyteCostHost+"/v1/cost", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	cli := newBinder()
	res, err := cli.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusOK {
		if binderCostNeedsFallback(res.StatusCode, b, "") {
			return nil, fmt.Errorf("binderbyte menolak origin/destination; pilih ulang kab/kota dari daftar wilayah")
		}
		return nil, fmt.Errorf("binderbyte cost HTTP %d: %s", res.StatusCode, string(b))
	}
	var parsed binderCostResp
	if err := json.Unmarshal(b, &parsed); err != nil {
		return nil, err
	}
	if !binderCostCodeOK(parsed.Code) {
		if binderCostNeedsFallback(res.StatusCode, b, parsed.Message) {
			return nil, fmt.Errorf("binderbyte menolak origin/destination; pilih ulang kab/kota dari daftar wilayah")
		}
		return nil, fmt.Errorf("binderbyte: %s", parsed.Message)
	}
	var out []ShippingQuote
	for _, res := range parsed.Data.Results {
		for _, c := range res.Costs {
			out = append(out, ShippingQuote{
				Courier:     strings.ToLower(strings.TrimSpace(res.Code)),
				CourierName: res.Name,
				Service:     c.Service,
				Description: c.Description,
				Price:       int64(math.Round(c.Cost)),
				Etd:         c.Etd,
			})
		}
	}
	return out, nil
}

// GetShippingCost menghitung ongkir Binderbyte dari alamat admin ke tujuan.
func GetShippingCost(originSlug, destinationSlug string, weightGram int, courier string) ([]ShippingQuote, error) {
	var lastErr error
	for _, origin := range shippingSlugCandidates(originSlug) {
		for _, destination := range shippingSlugCandidates(destinationSlug) {
			quotes, err := BinderbyteShippingCost(origin, destination, weightGram, courier)
			if err == nil {
				return quotes, nil
			}
			lastErr = err
			if !strings.Contains(strings.ToLower(err.Error()), "origin/destination") {
				return nil, err
			}
		}
	}
	if lastErr != nil {
		if strings.Contains(strings.ToLower(lastErr.Error()), "origin/destination") {
			return fallbackShippingQuotes(courier, weightGram), nil
		}
		return nil, lastErr
	}
	return nil, fmt.Errorf("origin dan destination kota wajib")
}

func fallbackShippingQuotes(courier string, weightGram int) []ShippingQuote {
	courier = strings.ToLower(strings.TrimSpace(courier))
	if courier == "" {
		courier = "jne"
	}
	kg := int(math.Ceil(float64(weightGram) / 1000.0))
	if kg < 1 {
		kg = 1
	}
	type fallbackService struct {
		name        string
		displayName string
		service     string
		description string
		base        int64
		etd         string
	}
	services := map[string][]fallbackService{
		"jne": {
			{name: "jne", displayName: "JNE Express", service: "REG", description: "Layanan Reguler", base: 12000, etd: "2-3"},
			{name: "jne", displayName: "JNE Express", service: "YES", description: "Yakin Esok Sampai", base: 22000, etd: "1-1"},
		},
		"sicepat": {
			{name: "sicepat", displayName: "SiCepat", service: "SIUNT", description: "SiUntung", base: 11500, etd: "2-3"},
			{name: "sicepat", displayName: "SiCepat", service: "BEST", description: "Besok Sampai Tujuan", base: 21000, etd: "1-1"},
		},
		"anteraja": {
			{name: "anteraja", displayName: "AnterAja", service: "REG", description: "Regular", base: 11000, etd: "2-4"},
			{name: "anteraja", displayName: "AnterAja", service: "NEXT", description: "Next Day", base: 20000, etd: "1-1"},
		},
		"pos": {
			{name: "pos", displayName: "POS Indonesia", service: "REGULER", description: "POS Reguler", base: 10000, etd: "2-4"},
			{name: "pos", displayName: "POS Indonesia", service: "KILAT", description: "POS Kilat Khusus", base: 18000, etd: "1-2"},
		},
		"lion": {
			{name: "lion", displayName: "Lion Parcel", service: "REGPACK", description: "Regular Package", base: 10500, etd: "2-4"},
			{name: "lion", displayName: "Lion Parcel", service: "ONEPACK", description: "One Day Package", base: 19000, etd: "1-1"},
		},
		"sap": {
			{name: "sap", displayName: "SAP Express", service: "REG", description: "Regular Service", base: 11000, etd: "2-4"},
			{name: "sap", displayName: "SAP Express", service: "ODS", description: "One Day Service", base: 21000, etd: "1-1"},
		},
		"ide": {
			{name: "ide", displayName: "ID Express", service: "STD", description: "Standard", base: 10000, etd: "2-4"},
			{name: "ide", displayName: "ID Express", service: "EXP", description: "Express", base: 18500, etd: "1-2"},
		},
		"ninja": {
			{name: "ninja", displayName: "Ninja Xpress", service: "STANDARD", description: "Standard Service", base: 11000, etd: "2-4"},
			{name: "ninja", displayName: "Ninja Xpress", service: "EXPRESS", description: "Express Service", base: 20000, etd: "1-2"},
		},
	}
	rows := services[courier]
	if len(rows) == 0 {
		rows = services["jne"]
	}
	out := make([]ShippingQuote, 0, len(rows))
	for _, row := range rows {
		out = append(out, ShippingQuote{
			Courier:     row.name,
			CourierName: row.displayName,
			Service:     row.service,
			Description: row.description,
			Price:       row.base * int64(kg),
			Etd:         row.etd,
			Note:        "Estimasi fallback karena BinderByte belum mengembalikan tarif untuk rute ini.",
		})
	}
	return out
}

func shippingSlugCandidates(slug string) []string {
	slug = strings.TrimSpace(strings.ToLower(slug))
	if slug == "" {
		return nil
	}
	seen := map[string]bool{}
	add := func(v string, out *[]string) {
		v = strings.Trim(strings.TrimSpace(v), ",")
		if v == "" || seen[v] {
			return
		}
		seen[v] = true
		*out = append(*out, v)
	}
	var out []string
	add(slug, &out)
	parts := strings.Split(slug, ",")
	if len(parts) > 1 {
		add(parts[len(parts)-1], &out)
	}
	return out
}

func ShippingOriginSlug(subdistrictName, districtName, cityName string) string {
	city := CityNameToBinderSlug(cityName)
	if city == "" {
		return ""
	}
	area := CityNameToBinderSlug(subdistrictName)
	if area == "" {
		area = CityNameToBinderSlug(districtName)
	}
	if area == "" {
		return city
	}
	return area + "," + city
}

// CityNameToBinderSlug mengubah label kab/kota (mis. "KOTA BANDUNG") menjadi slug untuk API cost.
func CityNameToBinderSlug(name string) string {
	s := strings.TrimSpace(name)
	if s == "" {
		return ""
	}
	u := strings.ToUpper(s)
	for _, p := range []string{"KAB.", "KAB ", "KOTA ADM.", "KOTA ADM ", "KOTA "} {
		if strings.HasPrefix(u, p) {
			u = strings.TrimSpace(u[len(p):])
			break
		}
	}
	var b strings.Builder
	for _, r := range strings.ToLower(u) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// MatchShippingPrice mencari harga persis untuk kurir + layanan (service code).
func MatchShippingPrice(quotes []ShippingQuote, courier, service string) (int64, bool) {
	courier = strings.ToLower(strings.TrimSpace(courier))
	service = strings.TrimSpace(service)
	for _, q := range quotes {
		if strings.ToLower(q.Courier) == courier && strings.EqualFold(q.Service, service) {
			return q.Price, true
		}
	}
	return 0, false
}
