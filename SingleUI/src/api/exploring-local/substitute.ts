import type { Cafe, CafeSearch, ExploringHealth } from '../../contracts/exploring-local';
import type { SourceScenario } from '../../contracts/service-source';
import { scenarioResult } from '../substitution/source';
import type { ExploringApi } from './client';

interface SamplePlace {
  district: string;
  cafe: Cafe;
}

const samplePlaces: SamplePlace[] = [
  {
    district: 'District 2',
    cafe: {
      name: 'The Workshop Coffee',
      address: '27 Ngô Quang Huy, Thảo Điền, District 2',
      rating: 4.7,
      reviews: 684,
      sourceUrl: null,
    },
  },
  {
    district: 'District 1',
    cafe: {
      name: 'The Coffee House Signature',
      address: 'Nguyễn Huệ, District 1 · specialty coffee',
      rating: 4.6,
      reviews: 528,
      sourceUrl: null,
    },
  },
  {
    district: 'District 1',
    cafe: {
      name: 'Shin Heritage',
      address: 'District 1 · Vietnamese coffee',
      rating: 4.5,
      reviews: 306,
      sourceUrl: null,
    },
  },
  {
    district: 'District 2',
    cafe: {
      name: 'Every Half Coffee Roasters',
      address: 'Thảo Điền, District 2',
      rating: 4.6,
      reviews: 392,
      sourceUrl: null,
    },
  },
  {
    district: 'District 2',
    cafe: {
      name: 'La Viet Coffee',
      address: 'Thảo Điền, District 2 · specialty coffee',
      rating: 4.5,
      reviews: 517,
      sourceUrl: null,
    },
  },
  {
    district: 'District 1',
    cafe: {
      name: 'The Vintage Emporium',
      address: 'District 1 · heritage shophouse café',
      rating: 4.4,
      reviews: 241,
      sourceUrl: null,
    },
  },
  {
    district: 'District 3',
    cafe: {
      name: 'Oromia Coffee & Lounge',
      address: 'District 3 · garden café',
      rating: 4.5,
      reviews: 732,
      sourceUrl: null,
    },
  },
  {
    district: 'District 7',
    cafe: {
      name: 'The Running Bean',
      address: 'Phú Mỹ Hưng, District 7',
      rating: 4.4,
      reviews: 264,
      sourceUrl: null,
    },
  },
  {
    district: 'Bình Thạnh',
    cafe: {
      name: 'Every Half Coffee Roasters',
      address: 'Bình Thạnh · specialty coffee',
      rating: 4.7,
      reviews: 318,
      sourceUrl: null,
    },
  },
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

function searchSamples(input: CafeSearch): Cafe[] {
  const query = normalize(input.district.trim());
  const districtMatches = query
    ? samplePlaces.filter((place) => {
        const district = normalize(place.district);
        const address = normalize(place.cafe.address ?? '');
        return district.includes(query) || query.includes(district) || address.includes(query);
      })
    : [];
  const selected = districtMatches.length
    ? districtMatches.map(({ cafe }) => cafe)
    : samplePlaces.map(({ cafe }) => ({
        ...cafe,
        address: null,
        substituteContext: { district: input.district || 'your location', matched: false },
      }));
  return selected
    .filter((cafe) => cafe.rating >= input.minRating && cafe.reviews >= input.minReviews)
    .map((cafe) => ({ ...cafe }));
}

export class ExploringSubstitute implements ExploringApi {
  constructor(private readonly scenario: SourceScenario) {}

  health(): Promise<ExploringHealth> {
    return scenarioResult<ExploringHealth>('exploring', this.scenario, {
      default: () => ({ ok: false, tool: 'Exploring Local', copilotReady: false }),
      'signed-out': () => ({ ok: false, tool: 'Exploring Local', copilotReady: false }),
    });
  }

  search(input: CafeSearch): Promise<Cafe[]> {
    return scenarioResult<Cafe[]>('exploring', this.scenario, {
      default: () => searchSamples(input),
      empty: () => [],
      'signed-out': () => {
        throw new Error('copilot-unavailable');
      },
    });
  }
}
