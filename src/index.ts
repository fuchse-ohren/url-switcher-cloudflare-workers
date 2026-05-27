const CORSHEADERS = {
	'Access-Control-Allow-Origin': process.env.CORS_DOMAIN || '127.0.0.1:8787',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	Vary: 'Origin',
};

type UrlSet = {
	browserUrl: string;
	otherUrl: string;
};

function secureResponse(status: number, headers: Record<string, string>, body: string): Response {
	headers['Strict-Transport-Security'] = 'max-age=31536000;';
	headers['X-Content-Type-Options'] = 'nosniff';
	headers['X-Frame-Options'] = 'DENY';
	headers['Referrer-Policy'] = 'no-referrer';
	headers['Cache-Control'] = 'no-cache, no-store';
	headers['X-XSS-Protection'] = '1; mode=block';
	headers['fox'] = 'cute';
	return new Response(body, {
		status,
		headers,
	});
}

function returnError(e: unknown) {
	var eMessage: string = '';

	if (e instanceof Error) {
		eMessage = e.message;
	} else {
		eMessage = 'エラーが発生しました';
	}

	return secureResponse(400, { 'Content-Type': 'application/json' }, `{"statusCode": 400, "error": "${eMessage}"}`);
}

function generateShortUrlKouho(length: number): string {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.!*)(';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}

	return result;
}

async function generateShortUrl(KV: KVNamespace): Promise<string> {
	var result: string = '';
	var retryCount = 0;
	const retryLimit = 6;
	const minimumLength = 1;

	while (1 && retryCount < retryLimit) {
		const shortUrl = generateShortUrlKouho(retryCount + minimumLength);
		if (!(await KV.get(shortUrl))) {
			result = shortUrl;
			break;
		}
		retryCount += 1;
	}

	if (retryLimit === retryCount) {
		throw new Error('短縮URLの生成に失敗しました。\\n衝突エラー');
	}

	return result;
}

function isValidUrl(inputUrl: string): boolean {
	const urlCond = new RegExp(
		'^' +
			'(?:https?):' +
			'(?:\\/\\/(?:' +
			"(?:[A-Za-z0-9\\-._~%!$&'()*+,;=:]+@)?" +
			'(?:' +
			'\\[[A-Fa-f0-9:.]+\\]' +
			'|' +
			'(?:[A-Za-z0-9\\-._~%]+)' +
			')' +
			'(?::\\d+)?' +
			')?)?' +
			"(?:\\/[A-Za-z0-9\\-._~%!$&'()*+,;=:@/]*)*" +
			"(?:\\?[A-Za-z0-9\\-._~%!$&'()*+,;=:@/?]*)?" +
			"(?:\\#[A-Za-z0-9\\-._~%!$&'()*+,;=:@/?]*)?" +
			'$',
	);

	return urlCond.test(inputUrl);
}

function isBrowserClient(userAgent: string | null): boolean {
	if (!userAgent) {
		return false;
	}

	const lowerUa = userAgent.toLowerCase();
	const nonBrowserWords = ['curl', 'wget', 'httpie', 'postmanruntime', 'python-requests', 'go-http-client'];
	if (nonBrowserWords.some((word) => lowerUa.includes(word))) {
		return false;
	}

	const browserWords = ['mozilla', 'firefox', 'chrome', 'safari', 'edg', 'opera'];
	return browserWords.some((word) => lowerUa.includes(word));
}

function pickRedirectUrl(rawValue: string, userAgent: string | null): string {
	try {
		const parsed = JSON.parse(rawValue) as UrlSet;
		if (typeof parsed.browserUrl === 'string' && typeof parsed.otherUrl === 'string') {
			if (isBrowserClient(userAgent)) {
				return parsed.browserUrl;
			}
			return parsed.otherUrl;
		}
	} catch {
		// 旧データは1つのURL文字列
	}
	return rawValue;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const origin = request.headers.get('Origin')?.replace(/^https?:\/\//, '').split('/')[0];
		const method: string = request.method;
		const url: URL = new URL(request.url);
		const body: string = await request.text();

		if (method === 'OPTIONS') {
			return secureResponse(204, CORSHEADERS, '');
		}

		if (method === 'POST' && (origin !== CORSHEADERS['Access-Control-Allow-Origin'] || origin === undefined)) {
			return secureResponse(403, { 'Content-Type': 'application/json' }, '{"statusCode": 403, "error": "オリジン検証エラー"}');
		}

		if (method === 'POST' && url.pathname === '/api/shorten' && request.headers.get('Content-Type') === 'application/json') {
			try {
				const { browserUrl, otherUrl } = JSON.parse(body);
				if (!isValidUrl(browserUrl) || !isValidUrl(otherUrl)) {
					throw new Error('無効なURLです。');
				}

				const shortUrl = await generateShortUrl(env.KV);
				const saveData: UrlSet = { browserUrl, otherUrl };
				await env.KV.put(shortUrl, JSON.stringify(saveData));
				return secureResponse(200, { 'Content-Type': 'application/json' }, `{"statusCode": 200, "shortUrl": "${url.origin}/${shortUrl}"}`);
			} catch (e) {
				return returnError(e);
			}
		}

		let redirectPathCond = /^\/[^\/]+\/?$/;
		if (method === 'GET' && redirectPathCond.test(url.pathname)) {
			try {
				const shortUrl = url.pathname.slice(1);
				const savedData = await env.KV.get(shortUrl);

				if (savedData) {
					const redirectUrl = pickRedirectUrl(savedData, request.headers.get('User-Agent'));
					return secureResponse(302, { Location: redirectUrl }, '');
				} else {
					return secureResponse(404, { 'Content-Type': 'text/plain' }, '');
				}
			} catch (e) {
				return returnError(e);
			}
		}

		return secureResponse(400, { 'Content-Type': 'application/json' }, '{"statusCode": 400, "error": "Bad Request"}');
	},
} satisfies ExportedHandler<Env>;
