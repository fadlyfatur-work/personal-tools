const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(path, globals) {
  const scope = { exports: {}, ...globals }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, scope)
  return scope.exports
}
async function main() {
  const env = {}
  let calls = 0
  const route = load('app/api/timemark/location/route.ts', { URL, URLSearchParams, Response, AbortSignal, process: { env }, fetch: async url => {
    calls++
    assert.equal(url.pathname, '/v1/geocode/reverse')
    assert.equal(url.searchParams.get('lat'), '-6.2')
    assert.equal(url.searchParams.get('limit'), '1')
    return Response.json({ results: [{ country_code: 'id', formatted: 'Jakarta, Indonesia' }] })
  } })
  const request = body => new Request('http://localhost/api/timemark/location', { method: 'POST', body: JSON.stringify(body) })
  assert.equal((await route.POST(request(null))).status, 400)
  assert.equal((await route.POST(request({ lat: 91, lon: 0 }))).status, 400)
  assert.equal(calls, 0)
  assert.equal((await route.POST(request({ lat: -6.2, lon: 106.8 }))).status, 503)
  env.GEOAPIFY_API_KEY = 'test-only'
  const response = await route.POST(request({ lat: -6.2, lon: 106.8 }))
  assert.equal((await response.json()).address, 'Jakarta, Indonesia')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')

  let effect, resolveStream, stopped = 0, played = 0
  const video = { videoWidth: 640, videoHeight: 480, play: async () => { played++ } }
  const jsx = (type, props) => ({ type, props })
  let captured
  const Camera = load('app/timemark/camera.tsx', { File, document: { createElement: () => ({ getContext: () => ({ drawImage: () => {} }), toBlob: callback => callback(new Blob(['test'], { type: 'image/jpeg' })) }) }, navigator: { mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveStream = resolve }) } }, DOMException, require: name => name === 'react' ? {
    useRef: () => ({ current: video }), useState: initial => [initial, () => {}], useEffect: callback => { effect = callback },
  } : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : { default: {} } }).default
  const tree = Camera({ onCapture: async file => { captured = file }, onClose: () => {} })
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return
    if (predicate(node)) return node
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result }
  }
  await find(tree, node => node.type === 'button' && node.props.children === 'Ambil foto').props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(captured.type, 'image/jpeg')
  const cleanup = effect()
  cleanup()
  resolveStream({ getTracks: () => [{ stop: () => stopped++ }] })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(stopped, 1, 'Late camera permission must not leave the camera running')
  assert.equal(played, 0)
  const cleanupActive = effect()
  resolveStream({ getTracks: () => [{ stop: () => stopped++ }] })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(played, 1)
  cleanupActive()
  assert.equal(stopped, 2, 'Closing the camera must stop its tracks')
  let locationCallback, changes = []
  const LocationInput = load('app/timemark/location-input.tsx', { navigator: { geolocation: { getCurrentPosition: success => { locationCallback = success } } }, window: { isSecureContext: true }, AbortController, fetch: async () => Response.json({ address: 'Jakarta, Indonesia' }), require: name => name === 'react' ? {
    useRef: initial => ({ current: initial }), useState: initial => [initial, () => {}], useId: () => 'location-test', useEffect: () => {},
  } : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : name === './location-cache' ? { normalizeQuery: value => value.trim() } : { default: {} } }).default
  const locationTree = LocationInput({ value: '', disabled: false, onChange: value => changes.push(value) })
  const locate = find(locationTree, node => node.type === 'button' && node.props.children === 'Gunakan lokasi perangkat').props.onClick
  locate()
  await locationCallback({ coords: { latitude: -6.2, longitude: 106.8, accuracy: 20 } })
  assert.equal(changes.at(-1), 'Jakarta, Indonesia')
  locate()
  find(locationTree, node => node.type === 'input').props.onChange({ target: { value: 'Alamat manual' } })
  await locationCallback({ coords: { latitude: -6.2, longitude: 106.8, accuracy: 20 } })
  assert.equal(changes.at(-1), 'Alamat manual', 'Late device location must not overwrite manual edits')
  console.log('Device tests passed: reverse lookup, validation, camera capture/cleanup, device location, and preserving manual edits.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
