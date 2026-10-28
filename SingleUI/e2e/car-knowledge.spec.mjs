import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

const graph = {
  version: 1, updatedAt: '2026-10-25T00:00:00Z',
  terms: [
    { id: 'car', label: 'Car', category: 'vehicle', summary: 'A vehicle.', detail: 'A vehicle made of physical parts.', sources: [] },
    { id: 'engine', label: 'Engine', category: 'engine', summary: 'Produces power.', detail: 'An engine converts energy into mechanical work.', sources: [] },
  ],
  relations: [
    { id: 'engine--part-of--car', from: 'engine', to: 'car', kind: 'part-of', closeness: 0.8, support: 0, summary: 'An engine belongs to a car.', sources: [] },
  ],
};

test('standalone learning, backend boundary and cloned companion', async ({ page }, info) => {
  const backendCalls = [];
  await page.route('http://localhost:5311/**', async route => {
    backendCalls.push(new URL(route.request().url()).pathname);
    if (route.request().url().endsWith('/api/car-knowledge'))
      return route.fulfill({ json: graph });
    if (route.request().url().endsWith('/api/cars'))
      return route.fulfill({ json: [] });
    return route.fulfill({ status: 500 });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Car knowledge' })).toBeVisible();
  await expect(page.locator('.knowledge-panel h2')).toHaveText('Car');
  await expect(page.locator('bridge-dashboard')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sessions', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Engine is part of Car', exact: true }).click();
  await expect(page.locator('.knowledge-panel h2')).toHaveText('Engine');
  await expect(page.locator('.knowledge-panel')).toContainText('mechanical work');
  const bobby = page.locator('[data-hunter="bobby"]');
  await expect(bobby).toBeAttached();
  await bobby.click({ force: true });
  await expect(page.locator('[data-bubble-for="bobby"]')).toContainText('Bobby Singer');
  expect(backendCalls.sort()).toEqual(['/api/car-knowledge', '/api/cars', '/api/cars']);
  const tools = page.getByText('Drawings & placement', { exact: true });
  await expect(tools).toBeVisible();
  expect(await page.locator('car-knowledge-view').evaluate(view =>
    !!(view.compareDocumentPosition(document.querySelector('car-import-panel')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      if (width === 375) {
        const bubble = page.locator('[data-bubble-for="bobby"]');
        if (await bubble.isVisible()) {
          await expect(async () => {
            const bounds = await bubble.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
          }).toPass({ timeout: 5000 });
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const mapTab = await page.getByRole('tab', { name: 'Term map' }).boundingBox();
      const assemblyTab = await page.getByRole('tab', { name: '3D assembly' }).boundingBox();
      expect(mapTab.height).toBeGreaterThanOrEqual(44);
      expect(assemblyTab.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(mapTab.y - assemblyTab.y)).toBeLessThan(2);
      expect(await page.locator('.knowledge-stage #knowledge-vehicle').count()).toBe(0);
      expect(await page.locator('.knowledge-sidebar').evaluate(sidebar => {
        const details = sidebar.querySelector('aside');
        const transcript = sidebar.querySelector('car-transcript-form');
        return !!(details.compareDocumentPosition(transcript) & Node.DOCUMENT_POSITION_FOLLOWING);
      })).toBe(true);
      await expect(page.locator('.study-heading #knowledge-vehicle')).toBeVisible();
      if (width === 1440) {
        const panel = await page.locator('.knowledge-panel').boundingBox();
        const stage = await page.locator('.knowledge-stage').boundingBox();
        expect(Math.abs(panel.y - stage.y)).toBeLessThan(2);
        const chooser = await page.locator('.study-heading car-vehicle-chooser').boundingBox();
        expect(Math.abs(chooser.x + chooser.width - panel.x - panel.width)).toBeLessThan(2);
      }
      await page.screenshot({ path: info.outputPath(`learning-${colorScheme}-${width}.png`), fullPage: true });
    }
  }
});

test('backend failure stays explicit without a fake graph', async ({ page }) => {
  await page.route('http://localhost:5311/api/cars', route => route.fulfill({ json: [] }));
  await page.route('http://localhost:5311/api/car-knowledge', route => route.fulfill({ status: 500, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('HTTP 500');
  await expect(page.getByText('Start the car API with dotnet run --project src/Car', { exact: false })).toBeVisible();
  await expect(page.locator('.knowledge-term')).toHaveCount(0);
});

test('transcript form posts actual input and preserves text on a conflict', async ({ page }) => {
  await page.route('http://localhost:5311/api/cars', route => route.fulfill({ json: [] }));
  const submissions = [];
  await page.route('http://localhost:5311/api/car-knowledge', route => route.fulfill({ json: graph }));
  await page.route('http://localhost:5311/api/car-transcripts', async route => {
    submissions.push(route.request().postDataJSON());
    if (submissions.length === 1)
      return route.fulfill({ status: 409, json: { error: 'Transcript already exists.' } });
    return route.fulfill({ status: 201, json: {
      videoId: 'abcdefghijk', path: 'transcripts/abcdefghijk/en.txt', language: 'en', status: 'saved',
    } });
  });
  await page.goto('/');
  await page.getByText('Add a transcript', { exact: true }).click();
  await page.getByLabel('YouTube video URL').fill('https://youtu.be/abcdefghijk');
  await page.getByLabel('Transcript text').fill('An engine converts energy.');
  await page.getByRole('button', { name: 'Save transcript', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await expect(page.getByLabel('Transcript text')).toHaveValue('An engine converts energy.');
  await page.getByRole('button', { name: 'Save transcript', exact: true }).click();
  await expect(page.locator('car-transcript-form').getByRole('status')).toContainText('transcripts/abcdefghijk/en.txt');
  expect(submissions[1]).toEqual({ url: 'https://youtu.be/abcdefghijk', language: 'en', title: '', text: 'An engine converts energy.' });
});

test('car form, word drawing and per-car placement show which car and part a drawing belongs to', async ({ page }, info) => {
  const vehicle = {
    id: 'example-coupe-2019-unknown-unknown', make: 'Example', model: 'Coupe', year: 2019,
    market: 'unknown', variant: 'unknown', provenance: 'Entered in the car knowledge UI.',
  };
  const pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
  const asset = {
    id: 'a'.repeat(64), sourceFormat: 'glb', sourceHash: 'b'.repeat(64),
    provenance: 'not stated', fidelity: 'not stated', createdAt: '2026-10-27T00:00:00Z',
  };
  let cars = [];
  let engine = null;
  const calls = [];
  await page.route('http://localhost:5311/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/car-knowledge') return route.fulfill({ json: graph });
    if (path === '/api/cars') return route.fulfill({ json: cars });
    if (path === `/api/cars/${vehicle.id}/assembly`) return route.fulfill({ json: {
      vehicle, occurrences: engine ? [engine] : [], assets: engine ? [asset] : [],
    } });
    if (path === '/api/car-import/vehicles') {
      calls.push({ path, headers: request.headers(), body: request.postDataJSON() });
      if (cars.length) return route.fulfill({ status: 409, json: { error: 'This car already exists.', vehicleId: vehicle.id } });
      cars = [vehicle];
      return route.fulfill({ status: 201, json: vehicle });
    }
    if (path === `/api/car-import/vehicles/${vehicle.id}/drawings`) {
      calls.push({ path, headers: request.headers(), body: request.postDataBuffer()?.toString() ?? '' });
      engine = {
        id: 'engine', parentId: null, designId: `${vehicle.id}.engine`, definitionId: 'engine', label: 'Engine',
        assetId: asset.id, pose, coverage: 'drawable', provenance: 'not stated', customPlacement: false,
      };
      return route.fulfill({ status: 201, json: {
        asset, design: { id: engine.designId, label: 'Engine', definitionId: 'engine' },
        vehicle, affectedVehicles: [vehicle], occurrenceIds: ['engine'],
      } });
    }
    if (path === `/api/car-import/vehicles/${vehicle.id}/placements`) {
      const body = request.postDataJSON();
      calls.push({ path, method: request.method(), headers: request.headers(), body });
      engine = { ...engine, pose: body.pose ?? pose, customPlacement: !!body.pose };
      return route.fulfill({ json: { id: engine.id, designId: engine.designId, label: engine.label,
        pose: engine.pose, customPlacement: engine.customPlacement } });
    }
    return route.fulfill({ status: 404, json: { error: 'Not found.' } });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async text => { window.__copied.push(text); } },
    });
  });
  const lastCopied = () => page.evaluate(() => window.__copied.at(-1));
  await page.goto('/');
  await page.getByRole('button', { name: 'Engine is part of Car', exact: true }).click();
  await expect(page.locator('.knowledge-panel h2')).toHaveText('Engine');
  await page.getByText('Drawings & placement', { exact: true }).click();
  const panel = page.locator('car-import-panel');
  await expect(panel).toContainText('No cars yet. Add a car model to get started.');

  await page.getByRole('button', { name: 'Add car', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Make and model are required.');
  await page.getByLabel('Make').fill('Example');
  await page.getByLabel('Model', { exact: true }).fill('Coupe');
  await page.getByRole('button', { name: 'Copy a prompt for Copilot to complete this car’s details' }).click();
  await expect(panel.locator('car-model-form .copy-note')).toContainText('Prompt copied. Paste it into Copilot.');
  expect(await lastCopied()).toContain('"model": "Coupe",\n  "year": null');
  await page.getByLabel('Model year').fill('2019');
  await expect(panel.locator('car-model-form .copy-note')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add car', exact: true }).click();
  await expect(page.locator('#knowledge-vehicle')).toHaveValue(vehicle.id);
  await expect(panel.locator('.workspace-summary')).toContainText('Example Coupe');
  await expect(panel.locator('car-drawing-import select, input[type="radio"]')).toHaveCount(0);
  await expect(page.getByLabel('Car for drawings and placement')).toHaveCount(0);
  await expect(panel.locator('.summary-line').first()).toContainText('Engine · Example Coupe 2019');
  await page.getByRole('combobox', { name: 'Find a term' }).fill('Car');
  await page.getByRole('combobox', { name: 'Find a term' }).dispatchEvent('change');
  await expect(panel.locator('.summary-line').first()).toContainText('The whole car · Example Coupe 2019');
  await page.getByRole('button', { name: 'Engine is part of Car', exact: true }).click();
  await expect(panel.locator('.summary-line').first()).toContainText('Engine · Example Coupe 2019');
  await panel.locator('car-drawing-import input[type="file"]').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not geometry'),
  });
  await expect(panel.locator('car-drawing-import [role="alert"]')).toContainText('GLB, glTF, FBX or OBJ');
  await expect(page.getByRole('button', { name: 'Import drawing', exact: true })).toBeDisabled();
  await panel.locator('car-drawing-import input[type="file"]').setInputFiles({
    name: 'engine.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('synthetic geometry'),
  });
  await page.getByRole('button', { name: 'Import drawing', exact: true }).click();
  await expect(panel.locator('car-drawing-import [role="status"]'))
    .toContainText('Imported engine.glb as Engine of Example Coupe 2019. Set its position in Place a part.');
  await page.getByRole('button', { name: 'Copy a prompt for the 3D app to model this drawing' }).click();
  await expect(panel.locator('car-drawing-import .copy-note')).toContainText('the 3D app assistant');
  const fabrication = await lastCopied();
  expect(fabrication).toContain('"id": "engine",\n    "label": "Engine"');
  expect(fabrication).toContain('"make": "Example"');
  expect(fabrication).toContain('"+Y Up"');

  await expect(panel.locator('car-placement-editor select')).toHaveValue('engine');
  await expect(panel.locator('car-placement-editor .summary-line')).toContainText('the car’s origin');
  await expect(page.getByRole('button', { name: 'Save position', exact: true })).toBeDisabled();
  await page.getByLabel('X', { exact: true }).fill('1.2');
  await page.getByLabel('Turn (yaw)').fill('90');
  await expect(panel).toContainText('Previewing in 3D. Save to keep this position.');
  await expect(page.locator('car-assembly-view .viewport')).toBeVisible();
  await expect(page.locator('.knowledge-canvas')).toBeHidden();
  await page.getByLabel('Y · up').fill('15');
  await expect(panel.locator('.warning')).toContainText('More than 10 m');
  await page.getByLabel('Y · up').fill('0.4');
  await page.getByRole('button', { name: 'Save position', exact: true }).click();
  await expect(panel.locator('car-placement-editor .success')).toContainText('Saved the position of Engine for this car.');
  await expect(page.getByRole('button', { name: 'Use catalog position', exact: true })).toBeVisible();
  await expect(page.locator('.knowledge-canvas')).toBeVisible();

  const [created, drawing, placed] = calls;
  expect(calls).toHaveLength(3);
  for (const call of calls) expect(call.headers['x-car-import-intent']).toBe('car-knowledge-ui');
  expect(created.body).toEqual({ make: 'Example', model: 'Coupe', year: 2019, market: '', variant: '', provenance: '' });
  expect(drawing.body).toContain('engine.glb');
  expect(drawing.body).toMatch(/name="definitionId"\r\n\r\nengine\r\n/);
  expect(drawing.body).not.toContain('name="provenance"');
  expect(placed.method).toBe('PUT');
  expect(placed.body).toMatchObject({ occurrenceId: 'engine', designId: engine.designId });
  expect(placed.body.pose).toMatchObject({ x: 1.2, y: 0.4, z: 0 });
  expect(placed.body.pose.qy).toBeCloseTo(Math.SQRT1_2, 5);
  expect(placed.body.pose.qw).toBeCloseTo(Math.SQRT1_2, 5);
  await page.getByRole('button', { name: 'Copy a prompt for Copilot to estimate this part’s position' }).click();
  await expect(panel.locator('car-placement-editor .copy-note')).toBeVisible();
  const placement = await lastCopied();
  expect(placement).toContain('"parent": null');
  expect(placement).toContain('"x": 1.2');

  await page.getByText('Advanced: catalog JSON or exact part design', { exact: true }).click();
  await expect(panel).toContainText('Every part design of this car already has a drawing.');
  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`import-${colorScheme}-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test('advanced catalog import previews cars and parts before saving', async ({ page }) => {
  const vehicle = {
    id: 'example-coupe-2019', make: 'Example', model: 'Coupe', year: 2019,
    market: 'unknown', variant: 'track', provenance: 'Synthetic browser fixture.',
  };
  const design = {
    id: 'coupe-body', definitionId: 'car', label: 'Body panel', revision: '1',
    assetId: null, provenance: 'Synthetic browser fixture.',
  };
  const pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
  let cars = [];
  const uploads = [];
  await page.route('http://localhost:5311/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/car-knowledge') return route.fulfill({ json: graph });
    if (path === '/api/cars') return route.fulfill({ json: cars });
    if (path === `/api/cars/${vehicle.id}/assembly`) return route.fulfill({ json: {
      vehicle, assets: [], occurrences: [{
        id: 'body', parentId: null, designId: design.id, definitionId: design.definitionId, label: design.label,
        assetId: null, pose, coverage: 'missing', provenance: design.provenance,
      }],
    } });
    if (path === '/api/car-import/catalog') {
      const catalog = request.postDataJSON();
      cars = catalog.vehicles;
      uploads.push({ headers: request.headers(), body: catalog });
      return route.fulfill({ json: { vehicles: catalog.vehicles, designs: catalog.designs } });
    }
    return route.fulfill({ status: 404, json: { error: 'Not found.' } });
  });
  await page.goto('/');
  await page.getByText('Drawings & placement', { exact: true }).click();
  await page.getByText('Advanced: catalog JSON or exact part design', { exact: true }).click();
  await page.locator('car-advanced-import input[type="file"]').first().setInputFiles({
    name: 'catalog.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      version: 1, vehicles: [vehicle], designs: [design],
      vehicleParts: [{ vehicleId: vehicle.id, key: 'body', designId: design.id, pose }],
    })),
  });
  await expect(page.locator('.catalog-preview')).toContainText('Example Coupe · 2019');
  await expect(page.locator('.catalog-preview')).toContainText('Body panel');
  await page.getByRole('button', { name: 'Import catalog', exact: true }).click();
  await expect(page.locator('car-advanced-import [role="status"]').first()).toContainText('Imported 1 car model');
  await expect(page.locator('#knowledge-vehicle')).toHaveValue(vehicle.id);
  await expect(page.getByLabel('Part/design without a drawing')).toHaveValue(design.id);
  expect(uploads).toHaveLength(1);
  expect(uploads[0].headers['x-car-import-intent']).toBe('car-knowledge-ui');
  expect(uploads[0].body.vehicles[0]).toMatchObject({ make: 'Example', model: 'Coupe', year: 2019 });
});

test('one vehicle and map selection drive whole-car and part uploads without a fallback car', async ({ page }) => {
  const vehicles = [
    { id: 'coupe', make: 'Example', model: 'Coupe', year: 2019, market: 'unknown', variant: 'unknown', provenance: 'Fixture' },
    { id: 'sedan', make: 'Example', model: 'Sedan', year: 2020, market: 'unknown', variant: 'unknown', provenance: 'Fixture' },
  ];
  const uploads = [];
  await page.route('http://localhost:5311/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/car-knowledge') return route.fulfill({ json: graph });
    if (path === '/api/cars') return route.fulfill({ json: vehicles });
    const vehicle = vehicles.find(car => path.includes(`/vehicles/${car.id}/`) || path.includes(`/cars/${car.id}/`));
    if (path.endsWith('/assembly')) return route.fulfill({ json: { vehicle, occurrences: [], assets: [] } });
    if (path.endsWith('/drawings')) {
      const body = request.postDataBuffer().toString();
      uploads.push({ path, body });
      const definitionId = body.match(/name="definitionId"\r\n\r\n([^\r]+)/)[1];
      return route.fulfill({ status: 201, json: {
        vehicle, asset: {
          id: 'a'.repeat(64), sourceHash: 'b'.repeat(64), sourceFormat: 'glb',
          provenance: 'Synthetic fixture', fidelity: 'Unverified', createdAt: '2026-10-27T00:00:00Z',
        }, design: { id: `${vehicle.id}.${definitionId}`, definitionId, label: definitionId },
        affectedVehicles: [vehicle], occurrenceIds: [],
      } });
    }
    return route.fulfill({ status: 404 });
  });
  await page.goto('/');
  await page.getByText('Drawings & placement', { exact: true }).click();
  const drawing = page.locator('car-drawing-import');
  await expect(page.getByLabel('Vehicle configuration')).toHaveValue('');
  await expect(drawing.locator('input[type="file"]')).toHaveCount(0);
  await expect(drawing).toContainText('Add or choose a car first.');

  await page.getByLabel('Vehicle configuration').selectOption('coupe');
  await expect(drawing.locator('.summary-line')).toContainText('The whole car · Example Coupe 2019');
  await drawing.locator('input[type="file"]').setInputFiles({
    name: 'car.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('synthetic car geometry'),
  });
  await drawing.getByRole('button', { name: 'Import drawing', exact: true }).click();
  await expect(drawing.getByRole('status')).toContainText('Imported car.glb');
  await page.getByRole('button', { name: 'Engine is part of Car', exact: true }).click();
  await page.getByLabel('Vehicle configuration').selectOption('sedan');
  await expect(drawing.locator('.summary-line')).toContainText('Engine · Example Sedan 2020');
  await expect(drawing.locator('select, input[type="radio"]')).toHaveCount(0);
  await drawing.locator('input[type="file"]').setInputFiles({
    name: 'engine.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('synthetic engine geometry'),
  });
  await drawing.getByRole('button', { name: 'Import drawing', exact: true }).click();
  await expect(drawing.getByRole('status')).toContainText('Imported engine.glb');
  expect(uploads.map(upload => upload.path)).toEqual([
    '/api/car-import/vehicles/coupe/drawings', '/api/car-import/vehicles/sedan/drawings',
  ]);
  expect(uploads[0].body).toMatch(/name="definitionId"\r\n\r\ncar\r\n/);
  expect(uploads[1].body).toMatch(/name="definitionId"\r\n\r\nengine\r\n/);
  await page.getByLabel('Vehicle configuration').selectOption('');
  await expect(drawing.locator('input[type="file"]')).toHaveCount(0);
  await expect(drawing).toContainText('Add or choose a car first.');
});

test('graph mode switches to assembled imported geometry and keyboard part selection', async ({ page }, info) => {
  await page.addInitScript(() => {
    const prototype = WebGL2RenderingContext.prototype;
    const names = new WeakMap();
    const getUniformLocation = prototype.getUniformLocation;
    prototype.getUniformLocation = function (...args) {
      const location = getUniformLocation.apply(this, args);
      if (location) names.set(location, args[1]);
      return location;
    };
    let viewDistance = 0;
    const uniformMatrix4fv = prototype.uniformMatrix4fv;
    prototype.uniformMatrix4fv = function (...args) {
      if (names.get(args[0]) === 'modelViewMatrix') {
        const matrix = args[2];
        viewDistance = Math.hypot(matrix[12], matrix[13], matrix[14]);
      }
      return uniformMatrix4fv.apply(this, args);
    };
    const clear = prototype.clear;
    prototype.clear = function (...args) {
      window.__carDrawCount = 0;
      window.__carViewDistances = [];
      return clear.apply(this, args);
    };
    for (const name of ['drawArrays', 'drawElements']) {
      const draw = prototype[name];
      prototype[name] = function (...args) {
        const result = draw.apply(this, args);
        window.__carDrawCount++;
        window.__carViewDistances.push(viewDistance);
        return result;
      };
    }
  });
  const assetId = 'a'.repeat(64);
  const pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
  const vehicle = { id: 'sample', make: 'Synthetic', model: 'Test', year: 2019, market: 'unknown', variant: 'unknown', provenance: 'Synthetic browser fixture only.' };
  const model = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.5, 0, 0], max: [0.5, 1, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  };
  const json = Buffer.from(JSON.stringify(model));
  const length = Math.ceil(json.length / 4) * 4;
  const bytes = Buffer.alloc(28 + length + 36);
  bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(length, 12); bytes.writeUInt32LE(0x4e4f534a, 16);
  bytes.fill(32, 20, 20 + length); json.copy(bytes, 20);
  bytes.writeUInt32LE(36, 20 + length); bytes.writeUInt32LE(0x004e4942, 24 + length);
  [-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0].forEach((number, i) => bytes.writeFloatLE(number, 28 + length + i * 4));
  await page.route('http://localhost:5311/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/car-knowledge') return route.fulfill({ json: {
      ...graph, terms: [...graph.terms,
        { id: 'piston', label: 'Piston', category: 'part', summary: 'Moves.', detail: 'A moving engine part.', sources: [] },
        { id: 'fuel', label: 'Fuel', category: 'system', summary: 'Fuel supply.', detail: 'No fixture geometry.', sources: [] },
      ],
    } });
    if (path === '/api/cars') return route.fulfill({ json: [vehicle] });
    if (path.startsWith('/api/car-assets/')) return route.fulfill({ contentType: 'model/gltf-binary', body: bytes });
    if (path === '/api/cars/sample/assembly') return route.fulfill({ json: {
      vehicle, occurrences: [
        { id: 'engine', parentId: null, designId: 'assembly', definitionId: 'engine', label: 'Engine assembly', assetId: null, pose, coverage: 'assembly', provenance: 'Test' },
        { id: 'engine/left', parentId: 'engine', designId: 'part', definitionId: 'piston', label: 'Left engine fixture', assetId, pose: { ...pose, x: -0.6 }, coverage: 'drawable', provenance: 'Test' },
        { id: 'engine/right', parentId: 'engine', designId: 'part', definitionId: 'piston', label: 'Right engine fixture', assetId, pose: { ...pose, x: 0.6 }, coverage: 'drawable', provenance: 'Test' },
        { id: 'body', parentId: null, designId: 'body', definitionId: 'body', label: 'Body fixture', assetId, pose: { ...pose, x: 20 }, coverage: 'drawable', provenance: 'Test' },
      ], assets: [{ id: assetId, sourceFormat: 'glb', sourceHash: assetId, provenance: 'Synthetic test geometry', fidelity: 'Triangles, not real vehicle geometry', createdAt: '2026-10-25T00:00:00Z' }],
    } });
    return route.fulfill({ status: 404 });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Term map' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '3D assembly' })).toBeFocused();
  await expect(page.getByRole('tab', { name: '3D assembly' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.knowledge-canvas')).toBeHidden();
  await page.getByLabel('Vehicle configuration').selectOption('sample');
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__carDrawCount)).toBe(3);
  const unfocusedDistance = await page.evaluate(() => Math.min(...window.__carViewDistances));
  await page.getByRole('button', { name: 'Engine assembly', exact: true }).click();
  await expect(page.locator('.knowledge-panel h2')).toHaveText('Engine');
  await expect.poll(() => page.evaluate(() => window.__carDrawCount)).toBe(2);
  await expect(page.getByText('No drawing for this selection.', { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Math.max(...window.__carViewDistances))).toBeLessThan(unfocusedDistance / 4);
  await page.getByRole('button', { name: 'Left engine fixture', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.knowledge-panel h2')).toHaveText('Piston');
  await expect(page.getByRole('button', { name: 'Right engine fixture', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__carDrawCount)).toBe(2);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download GLB', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('sample.glb');
  const exportedPath = info.outputPath('sample.glb');
  await download.saveAs(exportedPath);
  const { readFile } = await import('node:fs/promises');
  const exported = await readFile(exportedPath);
  expect(exported.readUInt32LE(0)).toBe(0x46546c67);
  expect(exported.readUInt32LE(4)).toBe(2);
  const exportedModel = JSON.parse(exported.subarray(20, 20 + exported.readUInt32LE(12)).toString());
  expect(exportedModel.meshes.length).toBeGreaterThan(0);
  expect(exportedModel.nodes.filter(node => node.extras?.designId).length).toBe(4);
  expect(exportedModel.nodes.filter(node => node.mesh !== undefined)).toHaveLength(3);
  expect(exportedModel.nodes.some(node => node.extras?.designId === 'body')).toBe(true);
  expect(exportedModel.scenes[0].extras.vehicle.id).toBe('sample');
  expect(exportedModel.buffers.every(buffer => !buffer.uri)).toBe(true);
  await page.screenshot({ path: info.outputPath('assembled-geometry.png'), fullPage: true });
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => window.__carDrawCount)).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`isolated-${width}.png`), fullPage: true });
  }
  await page.getByRole('combobox', { name: 'Find a term' }).fill('Fuel');
  await page.getByRole('combobox', { name: 'Find a term' }).dispatchEvent('change');
  await expect(page.getByText('No drawing for this selection.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__carDrawCount)).toBe(0);
  await page.getByRole('combobox', { name: 'Find a term' }).fill('Car');
  await page.getByRole('combobox', { name: 'Find a term' }).dispatchEvent('change');
  await expect.poll(() => page.evaluate(() => window.__carDrawCount)).toBe(3);
  await page.getByRole('tab', { name: 'Term map' }).click();
  await expect(page.locator('.knowledge-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
