export function listing() {
  return {
    format: 'home-planner-listing',
    version: 1,
    source: {
      provider: 'zillow',
      title: 'Fictional Courtyard listing',
      listingUrl: 'https://www.zillow.com/',
      attribution:
        'Fictional test data; no actual Zillow photos or property data.',
      retrievedAt: '2026-09-09T12:00:00.000Z',
    },
    images: [
      {
        id: 'garden',
        url: 'https://images.example.org/garden.png',
        caption: 'Garden view',
        kind: 'photo',
      },
      {
        id: 'plan',
        url: 'https://images.example.org/plan.png',
        caption: 'Floor plan drawing',
        kind: 'floor-plan',
      },
    ],
    bindings: [],
  };
}
