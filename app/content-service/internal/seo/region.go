package seo

// DataForSEO location codes for supported regions.
// https://docs.dataforseo.com/v3/serp/google/locations/
const (
	LocationCodeAU = 2036
	LocationCodeUS = 2840
	LocationCodeUK = 2826
	LocationCodeNZ = 2554
	LocationCodeCA = 2124
)

// regionToLocationCode maps a target region code (au, us, uk, nz, ca) to the
// corresponding DataForSEO location_code. Unknown regions fall back to AU.
func regionToLocationCode(region string) int {
	switch region {
	case "us":
		return LocationCodeUS
	case "uk":
		return LocationCodeUK
	case "nz":
		return LocationCodeNZ
	case "ca":
		return LocationCodeCA
	case "au":
		return LocationCodeAU
	}
	return LocationCodeAU
}

// normaliseLanguage returns a DataForSEO-supported language code. Only "en"
// is supported in Phase 1; unknown inputs fall back to "en".
func normaliseLanguage(lang string) string {
	if lang == "en" {
		return "en"
	}
	return "en"
}
