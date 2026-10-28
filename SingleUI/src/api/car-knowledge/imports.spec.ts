import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceRequestError } from '../http/request';
import { CarImportClient, importErrorText } from './imports';

describe('Car import API boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uploads catalog JSON and drawing files with explicit import intent', async () => {
    const vehicle = {
      id: 'example-2019', make: 'Example', model: 'Coupe', year: 2019,
      market: 'unknown', variant: 'unknown', provenance: 'Synthetic fixture.',
    };
    const design = {
      id: 'body', definitionId: 'car', label: 'Body', revision: '1', assetId: null,
      provenance: 'Synthetic fixture.',
    };
    const asset = {
      id: 'a'.repeat(64), sourceFormat: 'glb', sourceHash: 'b'.repeat(64),
      provenance: 'Test source.', fidelity: 'Synthetic triangle.', createdAt: '2026-10-27T00:00:00Z',
    };
    const responseBodies = [
      { vehicles: [vehicle], designs: [design] },
      { asset, design: { id: 'body', label: 'Body', definitionId: 'car' }, vehicle, affectedVehicles: [vehicle] },
    ];
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(responseBodies.shift() ?? {}), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new CarImportClient();
    const catalogFile = new File(['{"version":1}'], 'catalog.json', { type: 'application/json' });
    await expect(client.catalog(catalogFile)).resolves.toMatchObject({ vehicles: [vehicle], designs: [design] });

    const drawingFile = new File(['synthetic'], 'body.glb', { type: 'model/gltf-binary' });
    await expect(client.drawing({
      file: drawingFile, vehicleId: vehicle.id, designId: 'body',
      provenance: 'Test source.', fidelity: 'Synthetic triangle.',
    })).resolves.toMatchObject({ asset, vehicle, affectedVehicles: [vehicle] });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:5311/api/car-import/catalog',
      'http://localhost:5311/api/car-import/vehicles/example-2019/designs/body/drawing',
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { 'X-Car-Import-Intent': 'car-knowledge-ui', 'Content-Type': 'application/json' },
      body: '{"version":1}',
    });
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ 'X-Car-Import-Intent': 'car-knowledge-ui' });
    const drawingBody = fetchMock.mock.calls[1][1]?.body;
    expect(drawingBody).toBeInstanceOf(FormData);
    if (!(drawingBody instanceof FormData)) throw new Error('Expected multipart drawing upload.');
    expect(drawingBody.get('file')).toMatchObject({ name: 'body.glb' });
  });

  it('creates cars from form fields, targets drawings by word and saves per-car placements', async () => {
    const vehicle = {
      id: 'mazda-rx-8-2004', make: 'Mazda', model: 'RX-8', year: 2004,
      market: 'unknown', variant: 'unknown', provenance: 'Entered in the import form; not independently verified.',
    };
    const asset = {
      id: 'a'.repeat(64), sourceFormat: 'glb', sourceHash: 'b'.repeat(64),
      provenance: 'not stated', fidelity: 'not stated', createdAt: '2026-10-27T00:00:00Z',
    };
    const pose = { x: 0, y: 0.4, z: 1.2, qx: 0, qy: 0, qz: 0, qw: 1 };
    const responses = [
      new Response(JSON.stringify(vehicle), { status: 201, headers: { 'content-type': 'application/json' } }),
      new Response(JSON.stringify({ error: 'This car model already exists.', vehicleId: vehicle.id }),
        { status: 409, headers: { 'content-type': 'application/json' } }),
      new Response(JSON.stringify({
        asset, design: { id: `${vehicle.id}.engine`, label: 'Engine', definitionId: 'engine' },
        vehicle, affectedVehicles: [vehicle], occurrenceIds: ['engine'],
      }), { headers: { 'content-type': 'application/json' } }),
      new Response(JSON.stringify({
        id: 'engine', parentId: null, designId: `${vehicle.id}.engine`, definitionId: 'engine', label: 'Engine',
        assetId: asset.id, pose, coverage: 'drawable', provenance: 'not stated', customPlacement: true,
      }), { headers: { 'content-type': 'application/json' } }),
    ];
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => responses.shift()!);
    vi.stubGlobal('fetch', fetchMock);
    const client = new CarImportClient();
    const form = { make: ' Mazda ', model: 'RX-8', year: 2004, market: '', variant: '', provenance: '' };

    await expect(client.createVehicle(form)).resolves.toEqual({ vehicleId: vehicle.id, existing: false });
    await expect(client.createVehicle(form)).resolves.toEqual({ vehicleId: vehicle.id, existing: true });
    const drawing = await client.drawingFor({
      file: new File(['synthetic'], 'engine.glb'), vehicleId: vehicle.id, definitionId: 'engine', provenance: '  ',
    });
    expect(drawing.occurrenceIds).toEqual(['engine']);
    await expect(client.place({ vehicleId: vehicle.id, occurrenceId: 'engine', designId: drawing.design.id, pose }))
      .resolves.toMatchObject({ id: 'engine', customPlacement: true, pose });

    expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      'POST http://localhost:5311/api/car-import/vehicles',
      'POST http://localhost:5311/api/car-import/vehicles',
      'POST http://localhost:5311/api/car-import/vehicles/mazda-rx-8-2004/drawings',
      'PUT http://localhost:5311/api/car-import/vehicles/mazda-rx-8-2004/placements',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ ...form, make: 'Mazda' });
    const upload = fetchMock.mock.calls[2][1]?.body;
    if (!(upload instanceof FormData)) throw new Error('Expected multipart drawing upload.');
    expect(upload.get('definitionId')).toBe('engine');
    expect(upload.has('provenance')).toBe(false);
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body)))
      .toEqual({ occurrenceId: 'engine', designId: `${vehicle.id}.engine`, pose });
    for (const [, init] of fetchMock.mock.calls)
      expect(init?.headers).toMatchObject({ 'X-Car-Import-Intent': 'car-knowledge-ui' });
  });

  it('shows the API sentence for a rejected import', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: '"Engine" already has a drawing in this car; existing geometry was not replaced.' }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    )));
    const error = await new CarImportClient().drawingFor({
      file: new File(['x'], 'engine.glb'), vehicleId: 'car-1', definitionId: 'engine',
    }).catch((caught: unknown) => caught);
    expect(importErrorText(error)).toBe('"Engine" already has a drawing in this car; existing geometry was not replaced.');
  });

  it('keeps API import failures explicit', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ error: 'Drawing would replace existing geometry.' }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new CarImportClient().catalog(new File(['{}'], 'catalog.json')))
      .rejects.toBeInstanceOf(ServiceRequestError);
  });
});
