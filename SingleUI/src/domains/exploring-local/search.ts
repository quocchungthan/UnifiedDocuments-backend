import { cafeSearchSchema, type CafeSearch } from '../../contracts/exploring-local';

const allowedDistrictChars = /[^\p{L}\p{N} ,.\-']/gu;

export function normalizeSearch(input: CafeSearch): CafeSearch {
  const parsed = cafeSearchSchema.parse(input);
  const district = parsed.district.replace(allowedDistrictChars, ' ').trim();
  if (district.length > 80) throw new Error('district-too-long');
  if ((parsed.latitude === undefined) !== (parsed.longitude === undefined))
    throw new Error('coordinates-incomplete');
  if (!district && parsed.latitude === undefined) throw new Error('location-required');
  return { ...parsed, district };
}

export function searchParams(input: CafeSearch): URLSearchParams {
  const search = normalizeSearch(input);
  const params = new URLSearchParams({
    minRating: String(search.minRating),
    minReviews: String(search.minReviews),
  });
  if (search.district) params.set('district', search.district);
  else {
    params.set('lat', String(search.latitude));
    params.set('lng', String(search.longitude));
  }
  return params;
}

export function searchLabel(input: CafeSearch): string {
  const search = normalizeSearch(input);
  if (search.district) return search.district;
  return `${search.latitude?.toFixed(3)}, ${search.longitude?.toFixed(3)}`;
}
