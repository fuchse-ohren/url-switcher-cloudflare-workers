import { describe, it, expect } from 'vitest';
import worker from '../src/index';

class FakeKv {
	data = new Map<string, string>();
	async get(key: string) {
		return this.data.get(key) ?? null;
	}
	async put(key: string, value: string) {
		this.data.set(key, value);
	}
}

describe('URL振り分け', () => {
	it('ブラウザのUser-AgentならbrowserUrlへリダイレクト', async () => {
		const kv = new FakeKv();
		kv.data.set('abc', JSON.stringify({ browserUrl: 'https://example.com/browser', otherUrl: 'https://example.com/other' }));
		const req = new Request('https://test.example/abc', { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0' } });
		const res = await worker.fetch(req, { KV: kv } as Env, {} as ExecutionContext);
		expect(res.status).toBe(302);
		expect(res.headers.get('Location')).toBe('https://example.com/browser');
	});

	it('curlのUser-AgentならotherUrlへリダイレクト', async () => {
		const kv = new FakeKv();
		kv.data.set('abc', JSON.stringify({ browserUrl: 'https://example.com/browser', otherUrl: 'https://example.com/other' }));
		const req = new Request('https://test.example/abc', { headers: { 'User-Agent': 'curl/8.0.1' } });
		const res = await worker.fetch(req, { KV: kv } as Env, {} as ExecutionContext);
		expect(res.status).toBe(302);
		expect(res.headers.get('Location')).toBe('https://example.com/other');
	});
});
