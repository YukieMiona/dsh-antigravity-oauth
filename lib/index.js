import { CONTEXT_WINDOW_EXCEEDED_CODE, IMAGE_OFFLOAD_REQUIRED_CODE, LlmAdapter, LlmError, ReasoningEffortId, RetryPolicySchema, ToolCallId, isContextWindowExceededError, offloadedImageText, requiredImageOffload, resolveImageAttachmentAccess } from "@deepseek-ai/dsh-llm";
import { chmod, copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { ProxyAgent, fetch as fetch$1 } from "undici";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import z from "@deepseek-ai/schemastery";
//#region src/image-input.ts
function accessOf(ref, resolveAccess) {
	try {
		return resolveAccess?.(ref);
	} catch {
		return;
	}
}
async function resolveImageBlock(block, attachments, signal, resolveAccess) {
	const name = block.attachment?.name || block.attachment?.attachmentId || "image";
	if (block.offloaded === true) return {
		type: "placeholder",
		text: offloadedImageText(block.attachment, accessOf(block.attachment, resolveAccess))
	};
	if (attachments !== void 0 && block.attachment !== void 0) try {
		const stored = await attachments.readImage(block.attachment, signal);
		if (stored?.data && stored.data.length > 0) return {
			type: "inline",
			mimeType: stored.ref?.mediaType || block.attachment?.mediaType || "image/png",
			data: Buffer.from(stored.data).toString("base64")
		};
	} catch (error) {
		if (signal?.aborted) throw error;
	}
	return {
		type: "placeholder",
		text: `[Image: ${name}]`
	};
}
//#endregion
//#region src/ids.ts
const AUTH_FILENAME = ".dsh-antigravity-oauth.json";
const HARNESS_ROUTE = "agy-google-antigravity";
const BOOT_MARKER = "[my-plugins/dsh-antigravity-oauth] loaded";
const STREAM_IDLE_TIMEOUT_MS = 3e5;
const AUTH_STATUS_PATH = "/plugins/dsh-antigravity-oauth/auth/status";
const AUTH_LOGIN_PATH = "/plugins/dsh-antigravity-oauth/auth/login";
const AUTH_COMPLETE_PATH = "/plugins/dsh-antigravity-oauth/auth/complete";
const AUTH_LOGOUT_PATH = "/plugins/dsh-antigravity-oauth/auth/logout";
const ACCOUNT_SWITCH_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/switch";
const ACCOUNT_REMOVE_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/remove";
const ACCOUNT_QUOTAS_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/quotas";
const ADVANCED_SETTINGS_PATH = "/plugins/dsh-antigravity-oauth/advanced";
const AVAILABLE_MODELS_PATH = "/plugins/dsh-antigravity-oauth/models/available";
const QUOTA_SUMMARY_PATH = "/v1internal:retrieveUserQuotaSummary";
const FETCH_AVAILABLE_MODELS_PATH = "/v1internal:fetchAvailableModels";
const DAILY_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com";
const CCA_ENDPOINTS = [DAILY_ENDPOINT, "https://daily-cloudcode-pa.sandbox.googleapis.com"];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
const CALLBACK_PORT = 51121;
const CALLBACK_URI = `http://127.0.0.1:${CALLBACK_PORT}/oauth-callback`;
const LOAD_CODE_ASSIST_PATH = "/v1internal:loadCodeAssist";
const ONBOARD_USER_PATH = "/v1internal:onboardUser";
const ONBOARD_TIMEOUT_MS = 3e4;
const ONBOARD_POLL_INTERVAL_MS = 1e3;
const ANTIGRAVITY_VERSION_MANIFEST_URL = "https://antigravity-hub-auto-updater-974169037036.us-central1.run.app/manifest/latest-arm64-mac.yml";
const OAUTH_REFRESH_POLL_MS = 9e5;
const OAUTH_EXPIRES_SKEW_MS = 3e5;
const RATE_LIMIT_COOLDOWN_MS = 6e5;
const RATE_LIMIT_COOLDOWN_MAX_MS = 72e5;
const WEB2API_ROUTE$1 = "agy-web";
const WEB2API_SETTINGS_PATH = "/plugins/dsh-antigravity-oauth/web2api/settings";
const WEB2API_TEST_PATH = "/plugins/dsh-antigravity-oauth/web2api/test";
const ACCOUNT_TOGGLE_ARGON_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/toggle-argon";
const MANAGER_TEST_PATH = "/plugins/dsh-antigravity-oauth/manager/test";
const MANAGER_SETTINGS_PATH = "/plugins/dsh-antigravity-oauth/manager/settings";
const MANAGER_FILENAME = ".dsh-antigravity-oauth.manager.json";
const DEFAULT_MANAGER_BASE_URL = "http://127.0.0.1:8045/v1";
const API_SERVER_PATH = "/plugins/dsh-antigravity-oauth/api-server";
const DEFAULT_API_SERVER_PORT = 18045;
const DEFAULT_API_SERVER_HOST = "127.0.0.1";
//#endregion
//#region src/idle-watchdog.ts
/**
* Abort a stream when no event arrives for `idleMs`. Each `touch()` restarts the timer, so a long
* stream that keeps sending events is never cut off. `signal` also follows the caller's cancel.
*/
var IdleWatchdog = class {
	idleMs;
	signal;
	controller = new AbortController();
	timer;
	expired = false;
	constructor(idleMs, cancel) {
		this.idleMs = idleMs;
		this.signal = cancel === void 0 ? this.controller.signal : AbortSignal.any([cancel, this.controller.signal]);
		this.touch();
	}
	/** True only when the idle time ran out, not when the caller cancelled. */
	get timedOut() {
		return this.expired;
	}
	touch() {
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.expired = true;
			this.controller.abort(/* @__PURE__ */ new Error(`stream idle for ${this.idleMs} ms`));
		}, this.idleMs);
	}
	dispose() {
		clearTimeout(this.timer);
	}
};
//#endregion
//#region src/models.ts
const DEFAULT_CATALOG_MODELS = [
	{
		id: "gemini-4-argon",
		name: "Gemini 4 Argon",
		contextWindow: 1048576,
		maxTokens: 65536,
		supportsImages: true,
		supportsThinking: true
	},
	{
		id: "gemini-3.8-flash",
		name: "Gemini 3.8 Flash",
		contextWindow: 1048576,
		maxTokens: 65536,
		supportsImages: true,
		supportsThinking: true
	},
	{
		id: "gemini-3.7-flash",
		name: "Gemini 3.7 Flash",
		contextWindow: 1048576,
		maxTokens: 65536,
		supportsImages: true,
		supportsThinking: true
	},
	{
		id: "gemini-3.5-flash",
		name: "Gemini 3.5 Flash",
		contextWindow: 1048576,
		maxTokens: 65536,
		supportsImages: true
	},
	{
		id: "claude-sonnet-4-6",
		name: "Claude Sonnet 4.6 (Thinking)",
		contextWindow: 25e4,
		maxTokens: 64e3,
		supportsImages: true,
		supportsThinking: true
	},
	{
		id: "claude-opus-4-6-thinking",
		name: "Claude Opus 4.6 (Thinking)",
		contextWindow: 25e4,
		maxTokens: 64e3,
		supportsImages: true,
		supportsThinking: true
	},
	{
		id: "gemini-2.5-pro",
		name: "Gemini 2.5 Pro",
		contextWindow: 1048576,
		maxTokens: 65535,
		supportsImages: true,
		supportsThinking: true
	},
	{
		id: "gpt-oss-120b-medium",
		name: "GPT-OSS 120B (Medium)",
		contextWindow: 131072,
		maxTokens: 32768,
		supportsThinking: true
	},
	{
		id: "gemini-3.5-flash-lite",
		name: "Gemini 3.5 Flash Lite",
		contextWindow: 1048576,
		maxTokens: 65535,
		supportsImages: true
	}
];
const PUBLIC_MODELS = [
	{
		id: "gemini-4-argon",
		name: "Gemini 4 Argon",
		contextWindow: 1048576,
		maxTokens: 65536
	},
	{
		id: "gemini-3.8-flash",
		name: "Gemini 3.8 Flash",
		contextWindow: 1048576,
		maxTokens: 65536
	},
	{
		id: "gemini-3.7-flash",
		name: "Gemini 3.7 Flash",
		contextWindow: 1048576,
		maxTokens: 65536
	},
	{
		id: "gemini-3.5-flash",
		name: "Gemini 3.5 Flash",
		contextWindow: 1048576,
		maxTokens: 65536
	}
];
const REASONING_EFFORTS = [
	"low",
	"medium",
	"high"
];
const DEFAULT_REASONING_EFFORT = "medium";
const DEFAULT_ENABLED_MODELS = ["gemini-3.8-flash"];
const WIRE = {
	"gemini-4-argon": {
		low: "gemini-4-argon-low",
		medium: "gemini-4-argon-medium",
		high: "gemini-4-argon-high"
	},
	"gemini-3.8-flash": {
		low: "gemini-3.8-flash-low",
		medium: "gemini-3.8-flash-medium",
		high: "gemini-3.8-flash-high"
	},
	"gemini-3.7-flash": {
		low: "gemini-3.7-flash-low",
		medium: "gemini-3.7-flash-medium",
		high: "gemini-3.7-flash-high"
	},
	"gemini-3.5-flash": {
		low: "gemini-3.5-flash-extra-low",
		medium: "gemini-3.5-flash-low",
		high: "gemini-3-flash-agent"
	}
};
const THINKING_LEVEL = {
	low: "LOW",
	medium: "MEDIUM",
	high: "HIGH"
};
function isPublicModelId(id) {
	return typeof id === "string" && id.trim().length > 0;
}
function routeChatModel(model, effort = DEFAULT_REASONING_EFFORT) {
	if (WIRE[model]) return WIRE[model][effort];
	return model;
}
function thinkingLevelFor(model, effort) {
	if (model.startsWith("claude-") || model.startsWith("gpt-")) return void 0;
	if (model === "gemini-3.5-flash" || model.includes("lite")) return void 0;
	return THINKING_LEVEL[effort];
}
function publicModel(id) {
	return DEFAULT_CATALOG_MODELS.find((model) => model.id === id) ?? PUBLIC_MODELS.find((model) => model.id === id);
}
//#endregion
//#region src/types.ts
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region src/schema.ts
const GEMINI_TYPES = /* @__PURE__ */ new Set([
	"string",
	"number",
	"integer",
	"boolean",
	"array",
	"object"
]);
function firstGeminiType(value) {
	if (typeof value === "string") {
		if (value === "null") return { nullable: true };
		return GEMINI_TYPES.has(value) ? {
			type: value,
			nullable: false
		} : { nullable: false };
	}
	if (!Array.isArray(value)) return { nullable: false };
	let type;
	let nullable = false;
	for (const entry of value) {
		if (entry === "null") {
			nullable = true;
			continue;
		}
		if (typeof entry === "string" && GEMINI_TYPES.has(entry) && type === void 0) type = entry;
	}
	return {
		type,
		nullable
	};
}
function unionBranch(raw) {
	if (!Array.isArray(raw) || raw.length === 0) return void 0;
	return raw.filter((entry) => {
		if (!isRecord(entry)) return true;
		return entry.type !== "null";
	})[0] ?? raw[0];
}
function sanitizeGeminiSchema(raw) {
	if (!isRecord(raw)) return void 0;
	const source = isRecord(unionBranch(raw.anyOf ?? raw.oneOf ?? raw.allOf)) ? {
		...raw,
		...unionBranch(raw.anyOf ?? raw.oneOf ?? raw.allOf)
	} : raw;
	const { type, nullable } = firstGeminiType(source.type);
	const out = {};
	if (type !== void 0) out.type = type;
	if (nullable || source.nullable === true) out.nullable = true;
	if (typeof source.description === "string" && source.description.length > 0) out.description = source.description;
	if (Array.isArray(source.enum)) {
		const values = source.enum.filter((entry) => typeof entry === "string" && entry.length > 0);
		if (values.length > 0) out.enum = values;
	}
	if (Array.isArray(source.required)) {
		const required = source.required.filter((entry) => typeof entry === "string");
		if (required.length > 0) out.required = required;
	}
	const properties = sanitizeProperties(source.properties);
	if (properties !== void 0) {
		out.properties = properties;
		if (out.type === void 0) out.type = "object";
	}
	if (source.items !== void 0) {
		const items = sanitizeGeminiSchema(source.items);
		if (items !== void 0) out.items = items;
		if (out.type === void 0) out.type = "array";
	}
	if (out.type === void 0 && out.enum !== void 0) out.type = "string";
	return Object.keys(out).length === 0 ? {
		type: "object",
		properties: {}
	} : out;
}
function sanitizeProperties(raw) {
	if (!isRecord(raw)) return void 0;
	const properties = {};
	for (const [key, value] of Object.entries(raw)) {
		const schema = sanitizeGeminiSchema(value);
		if (schema !== void 0) properties[key] = schema;
	}
	return properties;
}
function sanitizeGeminiParameters(raw) {
	return sanitizeGeminiSchema(raw) ?? {
		type: "object",
		properties: {}
	};
}
//#endregion
//#region src/native-tools.ts
const DSH_WEB_TOOL_NAMES = ["web_search", "web_fetch"];
const DSH_WEB_SECTION_NAMES = ["tool:web_search", "tool:web_fetch"];
const SEARCH_WEB_TOOL = "search_web";
const DROPPED_TOOL_NAMES = /* @__PURE__ */ new Set(["generate_image"]);
const DSH_WEB_TOOL_NAME_SET = new Set(DSH_WEB_TOOL_NAMES);
const DSH_WEB_SECTION_NAME_SET = new Set(DSH_WEB_SECTION_NAMES);
const SEARCH_WEB_NAME_SET = /* @__PURE__ */ new Set([SEARCH_WEB_TOOL, "web_search"]);
const SEARCH_GUIDANCE = "Use search_web for news and public-web facts. Do not call web_search, web_fetch, or generate_image. This route has no image generation. Cloud Code Assist v1internal cannot mix built-in googleSearch with function tools, so search_web runs as a separate googleSearch-only request. Search results come back to you as a tool result. Do not treat that grounded dump as the final user-facing answer; continue the original task in the user's language and call other tools if you still need files or commands.";
const SEARCH_INTENT = new RegExp([
	"搜搜",
	"网上搜",
	"搜一下",
	"查一下",
	"查查",
	"调研",
	"web search",
	"search the web",
	"look up",
	"\\bresearch\\b",
	"google\\s+(?:for|search)",
	"查新闻",
	"(?:搜|搜索).{0,8}(?:新闻|资讯|网页|资料|文档)",
	"最近\\s*\\d+\\s*(?:小时|天).{0,16}(?:新闻|资讯|科技)",
	"\\bnews\\b",
	"官方(?:资料|文档|网站)?",
	"怎么配",
	"怎么填",
	"有资料吗"
].join("|"), "i");
function latestUserText(messages) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message === void 0 || message.role !== "user") continue;
		if (message.source?.kind === "tool" || message.source?.kind === "plugin") continue;
		const text = message.content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text ?? "").join("").trim();
		if (text.length === 0) continue;
		if (text.includes("<system-reminder>") || text.includes("<available_skills>")) continue;
		if (text.startsWith("Current runtime context.")) continue;
		return text;
	}
	return "";
}
function wantsNativeSearch(text) {
	return SEARCH_INTENT.test(text);
}
const SEARCH_WEB_DECLARATION = {
	name: SEARCH_WEB_TOOL,
	description: "Search the public web via Cloud Code Assist googleSearch. Use this instead of web_search or web_fetch.",
	parameters: {
		type: "object",
		properties: { query: {
			type: "string",
			description: "Search query"
		} },
		required: ["query"]
	}
};
function isSearchWebToolName(name) {
	return SEARCH_WEB_NAME_SET.has(name);
}
function isDroppedToolName(name) {
	return DROPPED_TOOL_NAMES.has(name);
}
function isDshWebToolName(name) {
	return DSH_WEB_TOOL_NAME_SET.has(name);
}
function isDshWebSectionName(name) {
	return DSH_WEB_SECTION_NAME_SET.has(name);
}
function filterDshWebTools(tools) {
	if (tools === void 0) return [];
	return tools.filter((tool) => !isDshWebToolName(tool.name));
}
function ccaFunctionDeclarations(tools, search = true) {
	const kept = filterDshWebTools(tools ?? []).filter((tool) => tool.name !== "search_web" && !isDroppedToolName(tool.name)).map((tool) => ({
		name: tool.name,
		description: tool.description,
		parameters: sanitizeGeminiParameters(tool.parameters)
	}));
	if (search) kept.push(SEARCH_WEB_DECLARATION);
	return kept;
}
function maskDshWebAssembly(assembly) {
	return {
		...assembly,
		...Array.isArray(assembly?.tools) ? { tools: assembly.tools.filter((tool) => !isDshWebToolName(tool.name)) } : {},
		sections: [...Array.isArray(assembly?.sections) ? assembly.sections.filter((section) => !isDshWebSectionName(section.name)) : [], {
			name: "antigravity:native-tools",
			text: SEARCH_GUIDANCE
		}]
	};
}
function parseSearchWebArgs(args) {
	const query = typeof args.query === "string" ? args.query : typeof args.q === "string" ? args.q : typeof args.prompt === "string" ? args.prompt : typeof args.text === "string" ? args.text : "";
	if (query.length === 0) throw new Error("search_web requires a query");
	return query;
}
//#endregion
//#region src/search-turn.ts
const SEARCH_FOLLOW_UP_LIMIT = 3;
const SEARCH_CONTINUE_GUIDANCE = "Search results are source material for you, not the user-facing answer. Continue the original task. Reply in the same language the user used. Use other tools if you still need local files or commands.";
function appendSearchTurns(contents, calls, results) {
	if (calls.length === 0) return [...contents];
	const modelParts = calls.map((call) => ({
		functionCall: {
			name: call.name,
			args: call.args,
			id: call.id
		},
		...call.thoughtSignature === void 0 || call.thoughtSignature.length === 0 ? {} : { thoughtSignature: call.thoughtSignature }
	}));
	const userParts = calls.map((call, index) => ({ functionResponse: {
		name: call.name,
		id: call.id,
		response: { result: results[index] ?? "" }
	} }));
	return [
		...contents,
		{
			role: "model",
			parts: modelParts
		},
		{
			role: "user",
			parts: userParts
		}
	];
}
function appendSearchMemo(contents, query, result) {
	return [...contents, {
		role: "user",
		parts: [{ text: [
			`Web search results for: ${query}`,
			result,
			SEARCH_CONTINUE_GUIDANCE
		].join("\n\n") }]
	}];
}
const THOUGHT_ONLY_CONTINUE = "You produced only internal reasoning and stopped. Continue the original user task now. If you need public documentation or current product facts, call search_web. Then answer in the same language the user used. Do not stop after thinking.";
const SEARCH_ANSWER_GUIDANCE = "You already ran web search. The results above are source material. Answer the user now in their language. Do not call search_web. Use other tools only if you still need local files.";
function withoutSearchWeb(functions) {
	return functions.filter((tool) => !isSearchWebToolName(tool.name));
}
function appendSearchDossier(contents, rounds) {
	if (rounds.length === 0) return [...contents];
	const body = rounds.map((round, index) => `Search ${index + 1} for: ${round.query}\n${round.result}`).join("\n\n");
	return [...contents, {
		role: "user",
		parts: [{ text: `${body}\n\n${SEARCH_ANSWER_GUIDANCE}` }]
	}];
}
function appendContinueMemo(contents) {
	return [...contents, {
		role: "user",
		parts: [{ text: THOUGHT_ONLY_CONTINUE }]
	}];
}
function withSearchContinueGuidance(system) {
	if (system === void 0 || system.length === 0) return SEARCH_CONTINUE_GUIDANCE;
	if (system.includes("Search results are source material for you, not the user-facing answer. Continue the original task. Reply in the same language the user used. Use other tools if you still need local files or commands.")) return system;
	return `${system}\n\n${SEARCH_CONTINUE_GUIDANCE}`;
}
//#endregion
//#region src/manager/store.ts
const DEFAULT_MANAGER_SETTINGS = {
	enabled: false,
	baseUrl: DEFAULT_MANAGER_BASE_URL,
	apiKey: ""
};
/** Accepts `http(s)://host[:port][/path]` without credentials, query, or fragment; strips trailing slashes. */
function normalizeBaseUrl(raw) {
	if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_MANAGER_BASE_URL;
	const parsed = new URL(raw.trim());
	if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Gateway URL must use http or https");
	if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("Gateway URL must not contain credentials, a query, or a fragment");
	return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}
function chatCompletionsUrl(baseUrl) {
	return baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
}
function modelsUrl(baseUrl) {
	return baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
}
/** The gateway's unauthenticated liveness endpoint sits at the origin, not under `/v1`. */
function healthUrl(baseUrl) {
	return `${new URL(baseUrl).origin}/health`;
}
function parseStored(raw) {
	if (typeof raw !== "object" || raw === null) return { ...DEFAULT_MANAGER_SETTINGS };
	const data = raw;
	let baseUrl = DEFAULT_MANAGER_BASE_URL;
	try {
		baseUrl = normalizeBaseUrl(data.baseUrl);
	} catch {}
	return {
		enabled: data.enabled === true,
		baseUrl,
		apiKey: typeof data.apiKey === "string" ? data.apiKey.trim() : ""
	};
}
function viewOf(settings) {
	return {
		enabled: settings.enabled,
		baseUrl: settings.baseUrl,
		hasApiKey: settings.apiKey.length > 0,
		apiKeyHint: settings.apiKey.length >= 8 ? `…${settings.apiKey.slice(-4)}` : ""
	};
}
var AntigravityManagerStore = class {
	filename;
	cached;
	constructor(filename) {
		this.filename = filename;
	}
	/**
	* The adapter reads this on every request, so a short cache avoids a disk read per turn.
	* `save()` refreshes it, so a toggle in the UI takes effect immediately.
	*/
	async read() {
		if (this.cached !== void 0 && Date.now() - this.cached.at < 2e3) return this.cached.settings;
		let settings;
		try {
			settings = parseStored(JSON.parse(await readFile(this.filename, "utf8")));
		} catch (error) {
			if (error.code !== "ENOENT") console.warn("[dsh-antigravity-oauth] unreadable bridge settings, using defaults:", error.message);
			settings = { ...DEFAULT_MANAGER_SETTINGS };
		}
		this.cached = {
			settings,
			at: Date.now()
		};
		return settings;
	}
	/**
	* Merge a UI patch. `apiKey` omitted keeps the stored key; an empty string clears it.
	* Throws on an invalid URL so the UI can show the reason.
	*/
	async save(patch) {
		if (typeof patch !== "object" || patch === null) throw new Error("expected a JSON object");
		const data = patch;
		const current = await this.read();
		const next = {
			enabled: typeof data.enabled === "boolean" ? data.enabled : current.enabled,
			baseUrl: data.baseUrl === void 0 ? current.baseUrl : normalizeBaseUrl(data.baseUrl),
			apiKey: typeof data.apiKey === "string" ? data.apiKey.trim() : current.apiKey
		};
		await writeFileAtomic(this.filename, JSON.stringify(next, null, 2) + "\n", {
			mode: 384,
			dirMode: 448
		});
		this.cached = {
			settings: next,
			at: Date.now()
		};
		return next;
	}
};
//#endregion
//#region src/manager/bridge.ts
function textOf$1(blocks) {
	return blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
}
function imageName(block) {
	return block.attachment?.name || block.attachment?.attachmentId || "image";
}
/**
* Only images in the newest user turn and the trailing tool results travel as bytes. Older ones
* become placeholders: the gateway re-uploads every image on every request, and history images
* would otherwise grow each turn's payload without bound.
*/
function freshImages(messages) {
	const fresh = /* @__PURE__ */ new Set();
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "tool") {
			for (const b of msg.content) if (b.type === "image" && b.offloaded !== true) fresh.add(b);
			continue;
		}
		if (msg.role === "user") {
			for (const b of msg.content) if (b.type === "image" && b.offloaded !== true) fresh.add(b);
		}
		if (msg.role !== "developer") break;
	}
	return fresh;
}
async function imagePart(block, ctx) {
	if (!ctx.allowImages) return {
		type: "text",
		text: `[Image: ${imageName(block)} (image input disabled)]`
	};
	if (block.offloaded !== true && !ctx.fresh.has(block)) return {
		type: "text",
		text: `[Historical image: ${imageName(block)} (omitted to preserve context)]`
	};
	const image = await resolveImageBlock(block, ctx.attachments, ctx.signal, ctx.resolveAccess);
	return image.type === "inline" ? {
		type: "image_url",
		image_url: { url: `data:${image.mimeType};base64,${image.data}` }
	} : {
		type: "text",
		text: image.text
	};
}
async function userContent(blocks, ctx) {
	const parts = [];
	for (const block of blocks) if (block.type === "text" && block.text.length > 0) parts.push({
		type: "text",
		text: block.text
	});
	else if (block.type === "image") parts.push(await imagePart(block, ctx));
	if (parts.every((p) => p.type === "text")) return parts.map((p) => p.text).join("");
	return parts;
}
/** OpenAI tool messages are text only, so tool-result images degrade to their placeholder text. */
async function toolResultText(blocks, ctx) {
	const pieces = [];
	for (const block of blocks) if (block.type === "text" && block.text.length > 0) pieces.push(block.text);
	else if (block.type === "image") {
		if (block.offloaded === true) {
			const placeholder = await resolveImageBlock(block, ctx.attachments, ctx.signal, ctx.resolveAccess);
			pieces.push(placeholder.type === "placeholder" ? placeholder.text : `[Image: ${imageName(block)}]`);
		} else pieces.push(`[Image result: ${imageName(block)} (not forwarded through the bridge)]`);
	}
	return pieces.join("\n");
}
/**
* Translate a DSH request history into OpenAI chat messages.
*
* Tool-call ids are made unique (replayed compaction shadows can repeat one), and a tool result
* whose call is no longer in the history becomes plain user text so the payload stays legal.
*/
async function toBridgeMessages(options, io = {}) {
	const ctx = {
		fresh: freshImages(options.messages),
		attachments: io.attachments,
		signal: options.signal,
		resolveAccess: io.resolveAccess,
		allowImages: io.allowImages !== false
	};
	const out = [];
	const systemTexts = [];
	if (options.system !== void 0 && options.system.trim().length > 0) systemTexts.push(options.system.trim());
	const emitted = /* @__PURE__ */ new Map();
	const pending = /* @__PURE__ */ new Map();
	for (const message of options.messages) {
		if (message.role === "system") {
			const text = textOf$1(message.content).trim();
			if (text.length > 0) systemTexts.push(text);
			continue;
		}
		if (message.role === "user") {
			const content = await userContent(message.content, ctx);
			if (content.length > 0) out.push({
				role: "user",
				content
			});
			continue;
		}
		if (message.role === "assistant") {
			const text = textOf$1(message.content);
			const calls = [];
			for (const block of message.content) {
				if (block.type !== "tool-call") continue;
				const seen = emitted.get(block.id) ?? 0;
				emitted.set(block.id, seen + 1);
				const id = seen === 0 ? block.id : `${block.id}#${seen}`;
				const queue = pending.get(block.id);
				if (queue === void 0) pending.set(block.id, [id]);
				else queue.push(id);
				calls.push({
					id,
					type: "function",
					function: {
						name: block.name,
						arguments: block.arguments || "{}"
					}
				});
			}
			if (calls.length > 0) out.push({
				role: "assistant",
				content: text.length > 0 ? text : null,
				tool_calls: calls
			});
			else if (text.length > 0) out.push({
				role: "assistant",
				content: text
			});
			continue;
		}
		if (message.role === "tool") {
			const text = await toolResultText(message.content, ctx);
			const id = pending.get(message.toolCallId)?.shift();
			if (id === void 0) {
				if (text.length > 0) out.push({
					role: "user",
					content: `[Tool result]\n${text}`
				});
				continue;
			}
			out.push({
				role: "tool",
				tool_call_id: id,
				content: message.isError === true ? `[error] ${text}` : text
			});
		}
	}
	const answered = new Set(out.flatMap((m) => m.role === "tool" ? [m.tool_call_id] : []));
	for (let i = 0; i < out.length; i++) {
		const m = out[i];
		if (m.role !== "assistant" || m.tool_calls === void 0) continue;
		const missing = m.tool_calls.filter((c) => !answered.has(c.id));
		let insertAt = i + 1;
		while (insertAt < out.length && out[insertAt].role === "tool") insertAt++;
		for (const call of missing) {
			out.splice(insertAt++, 0, {
				role: "tool",
				tool_call_id: call.id,
				content: "[no result recorded]"
			});
			answered.add(call.id);
		}
	}
	const result = [...systemTexts.length > 0 ? [{
		role: "system",
		content: systemTexts.join("\n\n")
	}] : [], ...out];
	if (!result.some((m) => m.role === "user")) result.push({
		role: "user",
		content: "Continue."
	});
	return result;
}
function toBridgeTools(tools) {
	return (tools ?? []).filter((tool) => !isDroppedToolName(tool.name)).map((tool) => ({
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters
		}
	}));
}
function usageOf(raw) {
	const cached = raw.prompt_tokens_details?.cached_tokens ?? 0;
	const reasoning = raw.completion_tokens_details?.reasoning_tokens ?? 0;
	return {
		inputTokens: Math.max(0, (raw.prompt_tokens ?? 0) - cached),
		outputTokens: raw.completion_tokens ?? 0,
		...cached > 0 ? { cacheReadTokens: cached } : {},
		...reasoning > 0 ? { reasoningTokens: reasoning } : {}
	};
}
/** Errors before the first visible byte that are worth one more try at the gateway. */
function isRetryableStatus(status) {
	return status === 502 || status === 503 || status === 504 || status === 529;
}
function errorCodeFor(status, detail) {
	if (isContextWindowExceededError(detail)) return CONTEXT_WINDOW_EXCEEDED_CODE;
	if (status === 401 || status === 403) return "AUTH";
	if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail)) return "RATE_LIMIT";
	if (status >= 500) return "SERVER";
	return "UNKNOWN";
}
var BridgeHttpError = class extends Error {
	status;
	detail;
	constructor(status, detail) {
		super(`Antigravity Manager returned HTTP ${status}: ${detail.slice(0, 500)}`);
		this.status = status;
		this.detail = detail;
	}
};
/**
* Converts the gateway's SSE stream into DSH stream chunks with complete block lifecycles:
* every block opened with `block-start` is closed with a `block-end` carrying the assembled block.
*/
var BridgeStreamAssembler = class {
	index = 0;
	open;
	tool;
	toolCount = 0;
	usage;
	finishReason;
	visible = false;
	*delta(delta) {
		const thought = delta.reasoning_content ?? delta.reasoning;
		if (typeof thought === "string" && thought.length > 0) yield* this.appendText("reasoning", thought);
		if (typeof delta.content === "string" && delta.content.length > 0) yield* this.appendText("text", delta.content);
		for (const call of delta.tool_calls ?? []) yield* this.appendTool(call);
	}
	*appendText(kind, text) {
		if (this.open?.kind !== kind) {
			yield* this.closeAll();
			this.open = {
				kind,
				text: ""
			};
			yield {
				type: "block-start",
				index: this.index,
				blockType: kind
			};
		}
		this.open.text += text;
		this.visible = true;
		yield kind === "text" ? {
			type: "text-delta",
			index: this.index,
			text
		} : {
			type: "reasoning-delta",
			index: this.index,
			text
		};
	}
	*appendTool(call) {
		const openaiIndex = call.index ?? 0;
		if (this.tool === void 0 || this.tool.openaiIndex !== openaiIndex || call.id && call.id !== this.tool.id) {
			yield* this.closeAll();
			const id = call.id && call.id.length > 0 ? call.id : `call_bridge_${Date.now().toString(36)}_${this.toolCount}`;
			this.tool = {
				openaiIndex,
				id,
				name: call.function?.name ?? "",
				args: ""
			};
			this.toolCount += 1;
			yield {
				type: "block-start",
				index: this.index,
				blockType: "tool-call"
			};
		} else if (call.function?.name && this.tool.name.length === 0) this.tool.name = call.function.name;
		const argsDelta = call.function?.arguments ?? "";
		this.tool.args += argsDelta;
		this.visible = true;
		yield {
			type: "tool-call-delta",
			index: this.index,
			id: ToolCallId(this.tool.id),
			...this.tool.name.length > 0 ? { name: this.tool.name } : {},
			argumentsDelta: argsDelta
		};
	}
	*closeAll() {
		if (this.open !== void 0) {
			yield {
				type: "block-end",
				index: this.index,
				block: {
					type: this.open.kind,
					text: this.open.text
				}
			};
			this.index += 1;
			this.open = void 0;
		}
		if (this.tool !== void 0) {
			yield {
				type: "block-end",
				index: this.index,
				block: {
					type: "tool-call",
					id: ToolCallId(this.tool.id),
					name: this.tool.name || "unknown_tool",
					arguments: this.tool.args.length > 0 ? this.tool.args : "{}"
				}
			};
			this.index += 1;
			this.tool = void 0;
		}
	}
	*finish(model) {
		yield* this.closeAll();
		if (this.usage !== void 0) yield {
			type: "usage",
			usage: this.usage
		};
		if (this.toolCount > 0 || this.finishReason === "tool_calls") yield {
			type: "finish",
			reason: { kind: "tool-calls" }
		};
		else if (this.finishReason === "length") yield {
			type: "finish",
			reason: { kind: "max-tokens" }
		};
		else if (!this.visible) yield {
			type: "finish",
			reason: {
				kind: "error",
				failure: {
					message: `model "${model}" returned a completed response with no content`,
					code: "EMPTY_RESPONSE"
				}
			}
		};
		else yield {
			type: "finish",
			reason: { kind: "stop" }
		};
	}
};
async function* sseData(body, onBytes) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			onBytes();
			buffer += decoder.decode(value, { stream: true });
			let newline;
			while ((newline = buffer.indexOf("\n")) >= 0) {
				const line = buffer.slice(0, newline).replace(/\r$/, "");
				buffer = buffer.slice(newline + 1);
				if (line.startsWith("data:")) yield line.slice(5).trimStart();
			}
		}
		const tail = buffer.trim();
		if (tail.startsWith("data:")) yield tail.slice(5).trimStart();
	} finally {
		reader.releaseLock();
	}
}
const DEFAULT_RETRY_DELAYS_MS = [1500, 4e3];
function sleep(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal.aborted) return reject(signal.reason);
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal.reason);
		};
		signal.addEventListener("abort", onAbort, { once: true });
	});
}
async function openStream(options) {
	const fetchImpl = options.fetchImpl ?? fetch;
	const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
	const headers = {
		"content-type": "application/json",
		accept: "text/event-stream"
	};
	if (options.settings.apiKey) headers.authorization = `Bearer ${options.settings.apiKey}`;
	const body = JSON.stringify(options.request);
	for (let attempt = 0;; attempt++) {
		const res = await fetchImpl(chatCompletionsUrl(options.settings.baseUrl), {
			method: "POST",
			headers,
			body,
			signal: options.signal
		});
		options.onActivity();
		if (res.ok && res.body !== null) return res.body;
		const detail = await res.text().catch(() => "");
		if (res.ok) throw new BridgeHttpError(502, "empty response body");
		if (isRetryableStatus(res.status) && attempt < delays.length) {
			await sleep(delays[attempt], options.signal);
			continue;
		}
		throw new BridgeHttpError(res.status, detail || res.statusText);
	}
}
/** Stream one chat completion through the gateway as DSH chunks. */
async function* streamBridge(options) {
	const assembler = new BridgeStreamAssembler();
	try {
		const body = await openStream(options);
		for await (const data of sseData(body, options.onActivity)) {
			if (data === "[DONE]") break;
			let chunk;
			try {
				chunk = JSON.parse(data);
			} catch {
				continue;
			}
			if (chunk.error !== void 0) {
				const status = Number(chunk.error.code);
				throw new BridgeHttpError(Number.isInteger(status) && status >= 400 ? status : 502, chunk.error.message ?? JSON.stringify(chunk.error));
			}
			if (chunk.usage) assembler.usage = usageOf(chunk.usage);
			const choice = chunk.choices?.[0];
			if (choice?.delta) yield* assembler.delta(choice.delta);
			if (choice?.finish_reason) assembler.finishReason = choice.finish_reason;
		}
	} catch (error) {
		if (error instanceof BridgeHttpError) throw new LlmError(error.message, errorCodeFor(error.status, error.detail), { cause: error });
		if (options.signal.aborted) throw error;
		const message = error instanceof Error ? error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message : String(error);
		throw new LlmError(`Antigravity Manager is unreachable at ${options.settings.baseUrl} (${message}). Start the gateway or turn off the bridge in Settings → Antigravity.`, "TRANSPORT", { cause: error });
	}
	yield* assembler.finish(options.request.model);
}
//#endregion
//#region src/adapter.ts
const IMAGE_REQUEST_BUDGET = {
	representation: "base64",
	maxBytes: 16e6
};
function isValidImageMagicBytes(base64Data) {
	if (base64Data.length === 0) return false;
	try {
		const buf = Buffer.from(base64Data.slice(0, 32), "base64");
		if (buf.length === 0) return false;
		if (buf.length < 8) return true;
		if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) return true;
		if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71) return true;
		if (buf[0] === 71 && buf[1] === 73 && buf[2] === 70 && buf[3] === 56) return true;
		if (buf.length >= 12 && buf[0] === 82 && buf[1] === 73 && buf[2] === 70 && buf[3] === 70 && buf[8] === 87 && buf[9] === 69 && buf[10] === 66 && buf[11] === 80) return true;
		if (buf[0] === 66 && buf[1] === 77) return true;
		return false;
	} catch {
		return false;
	}
}
function imageBytesOf(ref) {
	return typeof ref.bytes === "number" && Number.isFinite(ref.bytes) && ref.bytes > 0 ? ref.bytes : 0;
}
const IDLE_TIMEOUT_MESSAGE = "Antigravity stream idle timeout";
function effortOf(options) {
	const raw = options.reasoningEffort;
	if (raw === "low") return "low";
	if (raw === "medium") return "medium";
	if (raw === "high") return "high";
	return DEFAULT_REASONING_EFFORT;
}
async function imagePartOf(block, attachments, signal, resolveAccess, disableImageUpload = false, isFresh = true, badImageIds) {
	if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : /* @__PURE__ */ new Error("aborted");
	const name = block.attachment?.name || block.attachment?.attachmentId || "image";
	const id = block.attachment?.attachmentId;
	if (id && badImageIds?.has(id)) return { text: `[Image: ${name} (upstream processing rejected, omitted)]` };
	if (block.offloaded === true) {
		const offloaded = await resolveImageBlock(block, attachments, signal, resolveAccess);
		return { text: offloaded.type === "placeholder" ? offloaded.text : "[image omitted]" };
	}
	if (disableImageUpload) return { text: `[Image: ${name} (Image upload disabled on Antigravity CCA route for account safety)]` };
	if (!isFresh) return { text: `[Historical Image: ${name} (omitted to preserve context)]` };
	const image = await resolveImageBlock(block, attachments, signal, resolveAccess);
	if (image.type === "inline") {
		if (isValidImageMagicBytes(image.data)) return { inlineData: {
			mimeType: image.mimeType,
			data: image.data
		} };
		return { text: `[Image: ${name} (invalid or corrupted image header)]` };
	}
	return { text: image.text };
}
function selectFreshImages(messages, imageSlidingWindow, maxFreshImages) {
	const liveImages = [];
	for (const message of messages) {
		if (message.role !== "user" && message.role !== "tool") continue;
		for (const block of message.content) if (block.type === "image" && block.offloaded !== true) liveImages.push(block);
	}
	if (!imageSlidingWindow) return new Set(liveImages);
	const fresh = /* @__PURE__ */ new Set();
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "user") {
			for (const block of msg.content) if (block.type === "image" && block.offloaded !== true) fresh.add(block);
			break;
		}
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "tool") {
			for (const block of msg.content) if (block.type === "image" && block.offloaded !== true) fresh.add(block);
			continue;
		}
		if (msg.role === "assistant" && !msg.content.some((b) => b.type === "tool-call")) continue;
		break;
	}
	let remaining = Math.max(0, maxFreshImages - fresh.size);
	for (let i = liveImages.length - 1; i >= 0 && remaining > 0; i--) {
		const block = liveImages[i];
		if (!fresh.has(block)) {
			fresh.add(block);
			remaining--;
		}
	}
	return fresh;
}
async function userPartsOf(blocks, attachments, signal, resolveAccess, disableImageUpload = false, freshSet, badImageIds) {
	const parts = [];
	for (const block of blocks) {
		if (block.type === "text") {
			if (block.text.length > 0) parts.push({ text: block.text });
			continue;
		}
		if (block.type === "image") {
			const isFresh = freshSet ? freshSet.has(block) : true;
			parts.push(await imagePartOf(block, attachments, signal, resolveAccess, disableImageUpload, isFresh, badImageIds));
		}
	}
	return parts;
}
/**
* Split a tool result into the text Gemini reads as `response.result` and the images it reads from
* `functionResponse.parts`. Placeholders for images that cannot be inlined stay where the image was,
* on their own line.
*/
async function toolResultOf(blocks, attachments, signal, resolveAccess, disableImageUpload = false, freshSet, badImageIds) {
	let text = "";
	let afterPlaceholder = false;
	const images = [];
	for (const block of blocks) {
		if (block.type === "text") {
			if (block.text.length === 0) continue;
			text += afterPlaceholder ? `\n${block.text}` : block.text;
			afterPlaceholder = false;
			continue;
		}
		if (block.type !== "image") continue;
		const part = await imagePartOf(block, attachments, signal, resolveAccess, disableImageUpload, freshSet ? freshSet.has(block) : true, badImageIds);
		if ("inlineData" in part) {
			images.push(part);
			continue;
		}
		text += text.length > 0 ? `\n${part.text}` : part.text;
		afterPlaceholder = true;
	}
	return {
		text,
		images
	};
}
async function convertMessages(messages, thoughtSignatures, attachments, signal, resolveAccess, disableImageUpload = false, imageSlidingWindow = true, maxFreshImages = 1, badImageIds) {
	const freshSet = selectFreshImages(messages, imageSlidingWindow, maxFreshImages);
	const toolNames = /* @__PURE__ */ new Map();
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const block of message.content) if (block.type === "tool-call") toolNames.set(block.id, block.name);
	}
	const contents = [];
	const emittedCount = /* @__PURE__ */ new Map();
	const emittedNames = /* @__PURE__ */ new Map();
	const pendingCallIds = /* @__PURE__ */ new Map();
	let responseTurn;
	let orphanParts = [];
	const flushOrphans = () => {
		responseTurn = void 0;
		if (orphanParts.length > 0) contents.push({
			role: "user",
			parts: orphanParts
		});
		orphanParts = [];
	};
	for (const message of messages) {
		if (message.role === "tool") {
			const result = await toolResultOf(message.content, attachments, signal, resolveAccess, disableImageUpload, freshSet, badImageIds);
			const queue = pendingCallIds.get(message.toolCallId);
			const id = queue !== void 0 && queue.length > 0 ? queue.shift() : void 0;
			if (id === void 0) {
				if (result.text.length > 0) orphanParts.push({ text: result.text });
				orphanParts.push(...result.images);
				continue;
			}
			const functionResponse = { functionResponse: {
				name: emittedNames.get(id) ?? toolNames.get(message.toolCallId) ?? "tool",
				id,
				response: { result: result.text },
				...result.images.length > 0 ? { parts: result.images } : {}
			} };
			if (responseTurn === void 0) {
				responseTurn = {
					role: "user",
					parts: []
				};
				contents.push(responseTurn);
			}
			responseTurn.parts.push(functionResponse);
			continue;
		}
		if (message.role === "assistant") {
			const parts = [];
			for (const block of message.content) {
				if (block.type === "text" && block.text.length > 0) parts.push({ text: block.text });
				if (block.type === "reasoning" && block.text.length > 0) parts.push({
					text: block.text,
					thought: true
				});
				if (block.type === "tool-call") {
					let args = {};
					try {
						args = JSON.parse(block.arguments);
					} catch {
						args = { raw: block.arguments };
					}
					const seen = emittedCount.get(block.id) ?? 0;
					emittedCount.set(block.id, seen + 1);
					const id = seen === 0 ? block.id : `${block.id}#${seen}`;
					const rawBlock = block;
					const blockSignature = typeof rawBlock.thoughtSignature === "string" && rawBlock.thoughtSignature.length > 0 ? rawBlock.thoughtSignature : void 0;
					const thoughtSignature = thoughtSignatures.get(block.id) ?? blockSignature;
					if (thoughtSignature !== void 0 && thoughtSignature.length > 0) {
						parts.push({
							functionCall: {
								name: block.name,
								args,
								id
							},
							thoughtSignature,
							thought_signature: thoughtSignature
						});
						emittedNames.set(id, block.name);
						const queue = pendingCallIds.get(block.id);
						if (queue === void 0) pendingCallIds.set(block.id, [id]);
						else queue.push(id);
					} else parts.push({ text: `[Tool Call: ${block.name}(${block.arguments})]` });
				}
			}
			if (parts.length > 0) {
				flushOrphans();
				contents.push({
					role: "model",
					parts
				});
			}
			continue;
		}
		if (message.role === "user") {
			const parts = await userPartsOf(message.content, attachments, signal, resolveAccess, disableImageUpload, freshSet, badImageIds);
			if (parts.length > 0) {
				flushOrphans();
				contents.push({
					role: "user",
					parts
				});
			}
		}
	}
	flushOrphans();
	if (contents.length === 0) contents.push({
		role: "user",
		parts: [{ text: "" }]
	});
	return contents;
}
function functionsFor(options, nativeSearch) {
	if (options.purpose === "compaction" || options.purpose === "session-title") return [];
	return ccaFunctionDeclarations(options.tools, nativeSearch);
}
function mergeUsageSnapshot(base, extra) {
	if (extra === void 0) return base;
	const reasoningTokens = Math.max(base?.reasoningTokens ?? 0, extra.reasoningTokens ?? 0);
	const cacheReadTokens = extra.cacheReadTokens ?? base?.cacheReadTokens;
	return {
		inputTokens: Math.max(base?.inputTokens ?? 0, extra.inputTokens),
		outputTokens: Math.max(base?.outputTokens ?? 0, extra.outputTokens),
		...reasoningTokens > 0 ? { reasoningTokens } : {},
		...cacheReadTokens === void 0 ? {} : { cacheReadTokens }
	};
}
function addRequestUsage(base, extra) {
	if (extra === void 0) return base;
	const reasoningTokens = (base?.reasoningTokens ?? 0) + (extra.reasoningTokens ?? 0);
	const cacheReadTokens = extra.cacheReadTokens ?? base?.cacheReadTokens;
	return {
		inputTokens: (base?.inputTokens ?? 0) + extra.inputTokens,
		outputTokens: (base?.outputTokens ?? 0) + extra.outputTokens,
		...reasoningTokens > 0 ? { reasoningTokens } : {},
		...cacheReadTokens === void 0 ? {} : { cacheReadTokens }
	};
}
function createEmitState() {
	return {
		index: 0,
		text: "",
		thought: "",
		usage: void 0,
		toolNames: [],
		finish: void 0,
		depth: 0,
		sawVisibleAnswer: false,
		searchRounds: [],
		answerPass: false
	};
}
function resetEmitState(state) {
	Object.assign(state, createEmitState());
}
var AntigravityAdapter = class extends LlmAdapter {
	session;
	options;
	badImageIds = /* @__PURE__ */ new Set();
	constructor(session, options) {
		super();
		this.session = session;
		this.options = options;
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: "Google Antigravity"
		};
	}
	async listModels(provider) {
		const inputModalities = this.options.disableImageUpload === true ? ["text"] : ["text", "image"];
		let catalog = DEFAULT_CATALOG_MODELS;
		if (typeof this.session.getAvailableModels === "function") try {
			catalog = await this.session.getAvailableModels();
		} catch {}
		new Map(catalog.map((m) => [m.id, m]));
		let enabledIds = ["gemini-3.8-flash"];
		if (typeof this.session.getAdvancedSettings === "function") try {
			const adv = await this.session.getAdvancedSettings();
			if (Array.isArray(adv?.enabledModels) && adv.enabledModels.length > 0) enabledIds = adv.enabledModels;
		} catch {}
		const enabledSet = new Set(enabledIds);
		const activeModels = catalog.filter((m) => enabledSet.has(m.id));
		return (activeModels.length > 0 ? activeModels : catalog.filter((m) => m.id === "gemini-3.8-flash")).map((model) => ({
			provider,
			id: model.id,
			name: model.name,
			inputModalities: model.supportsImages === false ? ["text"] : inputModalities
		}));
	}
	async resolveModel(provider, model) {
		let spec = publicModel(model);
		if (!spec && typeof this.session.getAvailableModels === "function") try {
			spec = (await this.session.getAvailableModels()).find((m) => m.id === model);
		} catch {}
		const name = spec?.name ?? model;
		const inputModalities = this.options.disableImageUpload === true ? ["text"] : ["text", "image"];
		let contextWindow = spec?.contextWindow;
		let defaultEffort = DEFAULT_REASONING_EFFORT;
		if (typeof this.session.getAdvancedSettings === "function") try {
			const adv = await this.session.getAdvancedSettings();
			if (typeof adv.modelContextWindow === "number" && Number.isFinite(adv.modelContextWindow) && Math.floor(adv.modelContextWindow) >= 1) contextWindow = Math.floor(adv.modelContextWindow);
			if (adv.defaultReasoningEffort && REASONING_EFFORTS.includes(adv.defaultReasoningEffort)) defaultEffort = adv.defaultReasoningEffort;
		} catch {}
		const effectiveContext = spec !== void 0 ? contextWindow !== void 0 ? Math.max(1, Math.min(contextWindow, spec.contextWindow)) : spec.contextWindow : void 0;
		return {
			provider,
			id: model,
			name,
			inputModalities: [...inputModalities],
			...spec === void 0 || effectiveContext === void 0 ? {} : {
				context: { contextWindow: effectiveContext },
				defaultMaxTokens: spec.maxTokens
			},
			reasoning: {
				efforts: REASONING_EFFORTS.map((id) => ({
					id: ReasoningEffortId(id),
					name: `${id.charAt(0).toUpperCase()}${id.slice(1)}`
				})),
				defaultEffort: ReasoningEffortId(defaultEffort)
			}
		};
	}
	async *stream(options) {
		if (options.provider !== "agy-google-antigravity") throw new LlmError(`dsh-antigravity-oauth does not own provider "${options.provider}"`, "NO_ADAPTER");
		if (!isPublicModelId(options.model)) throw new LlmError(`unknown Antigravity model "${options.model}"`, "UNKNOWN_MODEL");
		const targetModel = (options.purpose === "compaction" || options.purpose === "session-title") && options.model === "gemini-4-argon" ? "gemini-3.8-flash" : options.model;
		const bridge = await this.session.manager?.read();
		if (bridge?.enabled === true) {
			yield* this.streamViaBridge(options, targetModel, bridge);
			return;
		}
		const lease = await this.session.acquire({ model: targetModel });
		if (lease === void 0) throw new LlmError("Antigravity is not connected. Open Settings and sign in.", "MISSING_CREDENTIAL");
		const effort = effortOf(options);
		const wire = routeChatModel(targetModel, effort);
		const functions = functionsFor(options, this.options.nativeSearch);
		this.assertImageBudget(options);
		const contents = await convertMessages(options.messages, this.session.thoughtSignatures, this.options.resolveAttachments?.(), options.signal, this.options.resolveImageAccess, this.options.disableImageUpload === true, this.options.imageSlidingWindow !== false, this.options.maxFreshImages ?? 1, this.badImageIds);
		const input = {
			kind: "chat",
			model: wire,
			contents,
			...options.system === void 0 || options.system.length === 0 ? {} : { system: options.system },
			functions,
			...thinkingLevelFor(targetModel, effort) === void 0 ? {} : { thinkingLevel: thinkingLevelFor(targetModel, effort) }
		};
		const state = createEmitState();
		const hasInlineImages = contents.some((c) => c.parts.some((p) => "inlineData" in p));
		const watchdog = new IdleWatchdog(this.idleTimeoutFor(effort, hasInlineImages), options.signal);
		try {
			yield* this.streamWithFailover(options, targetModel, input, state, watchdog, lease);
		} finally {
			watchdog.dispose();
		}
	}
	assertImageBudget(options) {
		if (this.options.disableImageUpload === true) return;
		const offloadImages = requiredImageOffload(options.messages, IMAGE_REQUEST_BUDGET, (block) => imageBytesOf(block.attachment));
		if (offloadImages > 0) throw new LlmError(`Request images exceed the route budget; ${offloadImages} more oldest occurrence(s) must be offloaded.`, IMAGE_OFFLOAD_REQUIRED_CODE, { offloadImages });
	}
	idleTimeoutFor(effort, hasInlineImages) {
		const defaultIdleMs = effort === "high" || hasInlineImages ? 48e4 : STREAM_IDLE_TIMEOUT_MS;
		return this.options.streamIdleTimeoutMs ?? defaultIdleMs;
	}
	/**
	* Native bridge: send the request to the local Antigravity Manager (OpenAI-compatible) instead
	* of Cloud Code Assist. The gateway runs its own account pool and failover, so none of the
	* direct-path account logic applies here.
	*/
	async *streamViaBridge(options, targetModel, settings) {
		this.assertImageBudget(options);
		const effort = effortOf(options);
		const messages = await toBridgeMessages(options, {
			attachments: this.options.resolveAttachments?.(),
			resolveAccess: this.options.resolveImageAccess,
			allowImages: this.options.disableImageUpload !== true
		});
		const tools = options.purpose === "compaction" || options.purpose === "session-title" ? [] : toBridgeTools(options.tools);
		const request = {
			model: routeChatModel(targetModel, effort),
			messages,
			stream: true,
			stream_options: { include_usage: true },
			...options.maxTokens === void 0 ? {} : { max_tokens: options.maxTokens },
			...options.temperature === void 0 ? {} : { temperature: options.temperature },
			...options.stop === void 0 || options.stop.length === 0 ? {} : { stop: options.stop },
			...tools.length > 0 ? { tools } : {}
		};
		const hasInlineImages = messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
		const watchdog = new IdleWatchdog(this.idleTimeoutFor(effort, hasInlineImages), options.signal);
		try {
			yield* streamBridge({
				settings,
				request,
				signal: watchdog.signal,
				onActivity: () => watchdog.touch()
			});
		} catch (error) {
			if (watchdog.timedOut) throw new LlmError(IDLE_TIMEOUT_MESSAGE, "TIMEOUT", { cause: error });
			throw error;
		} finally {
			watchdog.dispose();
		}
	}
	async tryFailoverLease(model, currentAccountId, triedAccountIds, code, isArgonModelError, isCapacityError = false) {
		if (typeof this.session.acquireForAccount !== "function") return void 0;
		if (model === "gemini-4-argon") {
			if (!isArgonModelError && code !== "RATE_LIMIT" && code !== "AUTH" && !isCapacityError) return void 0;
			if (typeof this.session.findArgonAccount !== "function") return void 0;
			while (true) {
				const fallback = await this.session.findArgonAccount(triedAccountIds);
				if (fallback === void 0 || triedAccountIds.has(fallback.id)) return void 0;
				triedAccountIds.add(fallback.id);
				const nextLease = await this.session.acquireForAccount(fallback.id);
				if (nextLease !== void 0) return nextLease;
			}
		}
		if (code !== "RATE_LIMIT" && !isCapacityError) return void 0;
		const fallback = typeof this.session.findBestAccount === "function" ? await this.session.findBestAccount({
			excludeId: currentAccountId,
			family: "gemini"
		}) : typeof this.session.findFailoverAccount === "function" ? await this.session.findFailoverAccount(currentAccountId) : void 0;
		if (fallback === void 0 || triedAccountIds.has(fallback.id)) return void 0;
		triedAccountIds.add(fallback.id);
		const nextLease = await this.session.acquireForAccount(fallback.id);
		if (nextLease !== void 0) await this.session.switchAccount?.(fallback.id).catch(() => {});
		return nextLease;
	}
	async *streamWithFailover(options, targetModel, input, state, watchdog, lease) {
		let currentLease = lease;
		const triedAccountIds = /* @__PURE__ */ new Set([lease.accountId]);
		let emittedAnyChunk = false;
		let retriedBadImage = false;
		while (true) try {
			for await (const chunk of this.emitChat(options, input, state, watchdog, currentLease)) {
				emittedAnyChunk = true;
				yield chunk;
			}
			for (const chunk of this.closeThought(state)) {
				emittedAnyChunk = true;
				yield chunk;
			}
			for (const chunk of this.closeText(state)) {
				emittedAnyChunk = true;
				yield chunk;
			}
			if (state.usage !== void 0) yield {
				type: "usage",
				usage: state.usage
			};
			const kind = state.toolNames.length > 0 ? "tool-calls" : state.finish === "MAX_TOKENS" ? "max-tokens" : "stop";
			if (kind === "stop" && state.index === 0) {
				yield {
					type: "finish",
					reason: {
						kind: "error",
						failure: {
							message: `model "${options.model}" returned a completed response with no content`,
							code: "EMPTY_RESPONSE"
						}
					}
				};
				return;
			}
			yield {
				type: "finish",
				reason: { kind }
			};
			return;
		} catch (error) {
			if (error instanceof LlmError) throw error;
			if (watchdog.timedOut) throw new LlmError(IDLE_TIMEOUT_MESSAGE, "TIMEOUT", { cause: error });
			let message = error instanceof Error ? error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message : String(error);
			const isArgonModelError = targetModel === "gemini-4-argon" && /\b403\b|\b404\b|MODEL_NOT_FOUND|PERMISSION_DENIED/i.test(message);
			const isAccountBanned = /\bACCOUNT_DISABLED\b|\bUSER_SUSPENDED\b|\bACCOUNT_SUSPENDED\b|\baccount_forbidden\b/i.test(message);
			const isCapacityError = /\b503\b|UNAVAILABLE|capacity exhausted|temporarily unavailable/i.test(message);
			const isBadImageError = /\b400\b|INVALID_ARGUMENT|image.*(?:fail|corrupt|unsupported|invalid)|IMAGE_PROCESSING_FAILED/i.test(message);
			const code = /\b401\b|\b403\b/.test(message) ? "AUTH" : /\b429\b|RESOURCE_EXHAUSTED|quota exhausted/i.test(message) ? "RATE_LIMIT" : /\b5\d\d\b/.test(message) ? "SERVER" : "TRANSPORT";
			if (code === "RATE_LIMIT") this.session.noteRateLimited?.(currentLease.accountId);
			else if (isArgonModelError) this.session.noteArgonRejected?.(currentLease.accountId);
			else if (code === "AUTH" && isAccountBanned) this.session.noteAuthRejected?.(currentLease.accountId);
			const canFailover = !emittedAnyChunk && state.index === 0 && state.text.length === 0 && state.thought.length === 0;
			if (canFailover && isBadImageError && !retriedBadImage) {
				const activeImageIds = [];
				for (const msg of options.messages) for (const b of msg.content) if (b.type === "image" && b.attachment?.attachmentId) activeImageIds.push(b.attachment.attachmentId);
				if (activeImageIds.length > 0) {
					retriedBadImage = true;
					for (const id of activeImageIds) this.badImageIds.add(id);
					input.contents = await convertMessages(options.messages, this.session.thoughtSignatures, this.options.resolveAttachments?.(), options.signal, this.options.resolveImageAccess, this.options.disableImageUpload === true, this.options.imageSlidingWindow !== false, this.options.maxFreshImages ?? 1, this.badImageIds);
					resetEmitState(state);
					continue;
				}
			}
			if (canFailover) {
				const nextLease = await this.tryFailoverLease(targetModel, currentLease.accountId, triedAccountIds, code, isArgonModelError, isCapacityError);
				if (nextLease !== void 0) {
					resetEmitState(state);
					currentLease = nextLease;
					continue;
				}
			}
			if (code === "RATE_LIMIT") message = `Antigravity quota exhausted for this account${currentLease.email === void 0 ? "" : ` (${currentLease.email})`}. Switch to another saved account in Settings → Antigravity. [${message}]`;
			throw new LlmError(message, code, { cause: error });
		}
	}
	*handleThoughtEvent(event, state) {
		yield* this.closeText(state);
		if (state.thought.length === 0) yield {
			type: "block-start",
			index: state.index,
			blockType: "reasoning"
		};
		state.thought += event.text;
		yield {
			type: "reasoning-delta",
			index: state.index,
			text: event.text
		};
	}
	*handleTextEvent(event, state) {
		yield* this.closeThought(state);
		if (state.text.length === 0) yield {
			type: "block-start",
			index: state.index,
			blockType: "text"
		};
		state.text += event.text;
		state.sawVisibleAnswer = true;
		yield {
			type: "text-delta",
			index: state.index,
			text: event.text
		};
	}
	*handleFunctionCallEvent(event, state, pendingSearches) {
		yield* this.closeThought(state);
		yield* this.closeText(state);
		if (isDroppedToolName(event.name)) return;
		if (isSearchWebToolName(event.name) && this.options.nativeSearch) {
			const id = ToolCallId(event.id ?? `search_${state.index}`);
			if (event.thoughtSignature !== void 0 && event.thoughtSignature.length > 0) this.session.thoughtSignatures.set(id, event.thoughtSignature);
			pendingSearches.push({
				id,
				name: event.name === "web_search" ? SEARCH_WEB_TOOL : event.name,
				args: event.args,
				...event.thoughtSignature === void 0 || event.thoughtSignature.length === 0 ? {} : { thoughtSignature: event.thoughtSignature }
			});
			return;
		}
		const id = ToolCallId(event.id ?? `call_${state.index}`);
		if (event.thoughtSignature !== void 0 && event.thoughtSignature.length > 0) this.session.thoughtSignatures.set(id, event.thoughtSignature);
		const args = JSON.stringify(event.args);
		yield {
			type: "block-start",
			index: state.index,
			blockType: "tool-call"
		};
		yield {
			type: "tool-call-delta",
			index: state.index,
			id,
			name: event.name,
			argumentsDelta: args
		};
		yield {
			type: "block-end",
			index: state.index,
			block: {
				type: "tool-call",
				id,
				name: event.name,
				arguments: args,
				...event.thoughtSignature !== void 0 && event.thoughtSignature.length > 0 ? { thoughtSignature: event.thoughtSignature } : {}
			}
		};
		state.toolNames.push(event.name);
		state.index += 1;
		state.sawVisibleAnswer = true;
	}
	async *emitChat(options, input, state, watchdog, lease) {
		const pendingSearches = [];
		const attachments = this.options.resolveAttachments?.();
		let requestUsage;
		for await (const event of lease.cca.chat(lease.oauth, input, watchdog.signal)) {
			watchdog.touch();
			if (event.type === "usage") {
				requestUsage = mergeUsageSnapshot(requestUsage, event.usage);
				continue;
			}
			if (event.type === "thought") {
				yield* this.handleThoughtEvent(event, state);
				continue;
			}
			if (event.type === "text") {
				yield* this.handleTextEvent(event, state);
				continue;
			}
			if (event.type === "functionCall") {
				yield* this.handleFunctionCallEvent(event, state, pendingSearches);
				continue;
			}
			if (event.type === "inlineImage") {
				yield* this.closeThought(state);
				yield* this.closeText(state);
				yield* this.emitImage(state.index, event.mimeType, event.data, attachments);
				state.index += 1;
				state.sawVisibleAnswer = true;
				continue;
			}
			if (event.type === "finish") state.finish = event.reason;
		}
		state.usage = addRequestUsage(state.usage, requestUsage);
		const skipFollowUp = options.purpose === "compaction" || options.purpose === "session-title";
		const allowMoreSearch = !state.answerPass && !skipFollowUp && this.options.nativeSearch && state.searchRounds.length < 3;
		let memoQuery;
		if (allowMoreSearch && pendingSearches.length === 0 && state.toolNames.length === 0 && state.searchRounds.length === 0 && state.depth === 0) {
			const latest = latestUserText(options.messages);
			if (wantsNativeSearch(latest)) memoQuery = latest;
		}
		if (allowMoreSearch && (pendingSearches.length > 0 || memoQuery !== void 0)) {
			if (pendingSearches.length > 0) for (const call of pendingSearches) {
				const query = parseSearchWebArgs(call.args);
				const collected = await this.collectSearch(options, query, watchdog, lease);
				state.usage = addRequestUsage(state.usage, collected.usage);
				state.searchRounds.push({
					query,
					result: collected.text
				});
			}
			else if (memoQuery !== void 0) {
				const collected = await this.collectSearch(options, memoQuery, watchdog, lease);
				state.usage = addRequestUsage(state.usage, collected.usage);
				state.searchRounds.push({
					query: memoQuery,
					result: collected.text
				});
			}
			const last = state.searchRounds.at(-1);
			const contents = pendingSearches.length > 0 ? appendSearchTurns(input.contents, pendingSearches, pendingSearches.map((_, index) => state.searchRounds[state.searchRounds.length - pendingSearches.length + index]?.result ?? "")) : appendSearchMemo(input.contents, memoQuery ?? "", last?.result ?? "");
			if (state.searchRounds.length < 3) {
				state.depth += 1;
				yield* this.emitChat(options, {
					...input,
					contents,
					system: withSearchContinueGuidance(input.system)
				}, state, watchdog, lease);
				if (state.sawVisibleAnswer || state.toolNames.length > 0) return;
			} else input = {
				...input,
				contents
			};
		}
		if (skipFollowUp || state.sawVisibleAnswer || state.toolNames.length > 0) return;
		if (state.answerPass && state.depth >= 3) return;
		state.depth += 1;
		if (state.searchRounds.length > 0 && !state.answerPass) {
			state.answerPass = true;
			yield* this.emitChat(options, {
				...input,
				contents: appendSearchDossier(input.contents, state.searchRounds),
				functions: withoutSearchWeb(input.functions),
				system: withSearchContinueGuidance(`${input.system ?? ""}\n\n${SEARCH_ANSWER_GUIDANCE}`)
			}, state, watchdog, lease);
			return;
		}
		yield* this.emitChat(options, {
			...input,
			contents: appendContinueMemo(input.contents),
			functions: state.answerPass ? withoutSearchWeb(input.functions) : input.functions,
			system: withSearchContinueGuidance(input.system)
		}, state, watchdog, lease);
	}
	async collectSearch(options, query, watchdog, lease) {
		if (!isPublicModelId(options.model)) throw new LlmError(`unknown Antigravity model "${options.model}"`, "UNKNOWN_MODEL");
		const effort = effortOf(options);
		let text = "";
		let usage;
		for await (const event of lease.cca.search(lease.oauth, {
			kind: "search",
			model: routeChatModel(options.model, effort),
			query,
			...thinkingLevelFor(options.model, effort) === void 0 ? {} : { thinkingLevel: thinkingLevelFor(options.model, effort) }
		}, watchdog.signal)) {
			watchdog.touch();
			if (event.type === "text") text += event.text;
			if (event.type === "usage") usage = mergeUsageSnapshot(usage, event.usage);
		}
		const trimmed = text.trim();
		return {
			text: trimmed.length > 0 ? trimmed : "(no search results)",
			usage
		};
	}
	*closeText(state) {
		if (state.text.length === 0) return;
		yield {
			type: "block-end",
			index: state.index,
			block: {
				type: "text",
				text: state.text
			}
		};
		state.index += 1;
		state.text = "";
	}
	*closeThought(state) {
		if (state.thought.length === 0) return;
		yield {
			type: "block-end",
			index: state.index,
			block: {
				type: "reasoning",
				text: state.thought
			}
		};
		state.index += 1;
		state.thought = "";
	}
	async *emitImage(index, mimeType, data, attachments) {
		if (attachments !== void 0) {
			const bytes = Buffer.from(data, "base64");
			const attachment = await attachments.saveImage({
				data: bytes,
				mediaType: mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/gif" || mimeType === "image/webp" ? mimeType : "image/png"
			});
			yield {
				type: "block-start",
				index,
				blockType: "image"
			};
			yield {
				type: "block-end",
				index,
				block: {
					type: "image",
					attachment
				}
			};
			return;
		}
		yield {
			type: "block-start",
			index,
			blockType: "text"
		};
		yield {
			type: "text-delta",
			index,
			text: `[image ${mimeType} ${data.length} bytes]`
		};
		yield {
			type: "block-end",
			index,
			block: {
				type: "text",
				text: `[image ${mimeType} ${data.length} bytes]`
			}
		};
	}
};
function createAntigravityAdapter(session, options) {
	return new AntigravityAdapter(session, options);
}
//#endregion
//#region src/redact.ts
function safeMessage(error) {
	return (error instanceof Error ? error.message : String(error)).replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted token]").replace(/(\b(?:code|token|refresh_token|access_token|api[_-]?key|key)=)[^&\s]+/giu, "$1[redacted]").slice(0, 1e3);
}
function isSafeAuthUrl(raw) {
	try {
		const url = new URL(raw);
		if (url.protocol !== "https:") return false;
		const host = url.hostname.toLowerCase();
		return host === "accounts.google.com" || host.endsWith(".google.com");
	} catch {
		return false;
	}
}
//#endregion
//#region src/proxy-fetch.ts
const agents = /* @__PURE__ */ new Map();
function firstEnv(names) {
	for (const name of names) {
		const value = process.env[name];
		if (value !== void 0 && value.length > 0) return value;
	}
}
function noProxyList() {
	return (firstEnv(["NO_PROXY", "no_proxy"]) ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}
function hostMatchesNoProxy(host, pattern) {
	const lowerHost = host.toLowerCase();
	const lower = pattern.toLowerCase();
	if (lower === "*") return true;
	if (lower.startsWith(".")) return lowerHost === lower.slice(1) || lowerHost.endsWith(lower);
	return lowerHost === lower || lowerHost.endsWith(`.${lower}`);
}
function proxyUrlFor(target) {
	let url;
	try {
		url = new URL(target);
	} catch {
		return;
	}
	if (noProxyList().some((pattern) => hostMatchesNoProxy(url.hostname, pattern))) return void 0;
	if (url.protocol === "https:") return firstEnv([
		"HTTPS_PROXY",
		"https_proxy",
		"ALL_PROXY",
		"all_proxy",
		"HTTP_PROXY",
		"http_proxy"
	]);
	if (url.protocol === "http:") return firstEnv([
		"HTTP_PROXY",
		"http_proxy",
		"ALL_PROXY",
		"all_proxy"
	]);
}
function agentFor(proxy) {
	const existing = agents.get(proxy);
	if (existing !== void 0) return existing;
	const agent = new ProxyAgent(proxy);
	agents.set(proxy, agent);
	return agent;
}
async function envProxyFetch(input, init) {
	const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
	const proxy = proxyUrlFor(url);
	if (proxy === void 0) return fetch(input, init);
	return fetch$1(url, {
		...init,
		dispatcher: agentFor(proxy)
	});
}
//#endregion
//#region src/network.ts
const NETWORK_PATH = "/plugins/dsh-antigravity-oauth/network";
function parseNetwork(value) {
	if (!value || typeof value !== "object") throw new Error("Invalid network settings");
	const data = value;
	if (Object.keys(data).some((k) => k !== "mode" && k !== "url") || ![
		"auto",
		"direct",
		"proxy"
	].includes(String(data.mode)) || typeof data.url !== "string") throw new Error("Invalid network settings");
	let url = "";
	if (data.url.trim()) {
		const parsed = new URL(data.url.trim());
		if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.port === "0") throw new Error("Use an HTTP(S) proxy URL without credentials or a path");
		url = parsed.origin;
	}
	if (data.mode === "proxy" && !url) throw new Error("Proxy URL is required");
	return {
		mode: data.mode,
		url
	};
}
var AntigravityNetwork = class {
	filename;
	agents = /* @__PURE__ */ new Map();
	constructor(filename) {
		this.filename = filename;
	}
	async read() {
		try {
			return parseNetwork(JSON.parse(await readFile(this.filename, "utf8")));
		} catch (error) {
			if (error.code === "ENOENT") return {
				mode: "auto",
				url: ""
			};
			throw error;
		}
	}
	async save(value) {
		const settings = parseNetwork(value);
		await writeFileAtomic(this.filename, JSON.stringify(settings) + "\n", {
			mode: 384,
			dirMode: 448
		});
	}
	async snapshot() {
		const settings = await this.read();
		const proxy = settings.mode === "proxy" ? settings.url : settings.mode === "auto" ? proxyUrlFor("https://daily-cloudcode-pa.googleapis.com") : void 0;
		const effective = proxy ? new URL(proxy).origin : "direct";
		return {
			...settings,
			effective
		};
	}
	fetch = async (input, init) => {
		const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
		const upstream = init?.signal ?? (input instanceof Request ? input.signal : void 0);
		if (!new URL(url).pathname.endsWith(":streamGenerateContent")) {
			const timeout = AbortSignal.timeout(3e4);
			init = {
				...init,
				signal: upstream ? AbortSignal.any([upstream, timeout]) : timeout
			};
		}
		const settings = await this.read();
		if (settings.mode === "auto") return envProxyFetch(input, init);
		if (settings.mode === "direct") return fetch(input, init);
		let agent = this.agents.get(settings.url);
		if (!agent) {
			agent = new ProxyAgent(settings.url);
			this.agents.set(settings.url, agent);
		}
		return fetch$1(url, {
			...init,
			dispatcher: agent
		});
	};
	async dispose() {
		await Promise.all([...this.agents.values()].map((agent) => agent.close()));
	}
};
//#endregion
//#region src/manager/probe.ts
const PROBE_TIMEOUT_MS = 4e3;
async function reachable(url, fetchImpl, init) {
	try {
		await (await fetchImpl(url, {
			...init,
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
		})).body?.cancel().catch(() => void 0);
		return true;
	} catch {
		return false;
	}
}
async function listModels(baseUrl, apiKey, fetchImpl) {
	const start = Date.now();
	try {
		const headers = { accept: "application/json" };
		if (apiKey) headers.authorization = `Bearer ${apiKey}`;
		const res = await fetchImpl(modelsUrl(baseUrl), {
			headers,
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
		});
		const latencyMs = Date.now() - start;
		if (!res.ok) {
			await res.body?.cancel().catch(() => void 0);
			const hint = res.status === 401 || res.status === 403 ? " (check the API key)" : "";
			return {
				ok: false,
				latencyMs,
				models: [],
				error: `HTTP ${res.status}${hint}`
			};
		}
		const body = await res.json().catch(() => void 0);
		return {
			ok: true,
			latencyMs,
			models: Array.isArray(body?.data) ? body.data.map((m) => m?.id).filter((id) => typeof id === "string") : []
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			latencyMs: Date.now() - start,
			models: [],
			error: message
		};
	}
}
async function probeBridge(target, options = {}) {
	const fetchImpl = options.fetchImpl ?? fetch;
	const [models, gatewayUp, coreUp] = await Promise.all([
		listModels(target.baseUrl, target.apiKey, fetchImpl),
		reachable(healthUrl(target.baseUrl), fetchImpl),
		reachable(options.coreUrl ?? "http://127.0.0.1:18046", fetchImpl)
	]);
	return {
		...models,
		gatewayUp: gatewayUp || models.ok,
		coreUp
	};
}
//#endregion
//#region src/auth-routes.ts
function trustedRequest(req) {
	const remote = req.socket.remoteAddress;
	if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return false;
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const host = req.headers.host;
	if (host === void 0) return false;
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === new URL(`http://${host}`).host;
	} catch {
		return false;
	}
}
function json(res, status, value) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(value));
}
async function readJson$1(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > 4096) throw new Error("request body too large");
		chunks.push(chunk);
	}
	if (chunks.length === 0) return {};
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function codeFrom(value) {
	if (typeof value !== "object" || value === null) throw new Error("expected a JSON object");
	if ("code" in value && typeof value.code === "string") return value.code;
	if ("url" in value && typeof value.url === "string") return value.url;
	if ("value" in value && typeof value.value === "string") return value.value;
	throw new Error("expected { \"code\": \"...\" } or { \"url\": \"...\" }");
}
function registerAntigravityAuthRoutes(ctx, session, options = {}) {
	const notify = async () => {
		await options.onAuthChanged?.();
	};
	ctx.effect(() => {
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: NETWORK_PATH,
				handler: async (req, res) => {
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						if (req.method === "GET") return json(res, 200, await session.network.snapshot());
						const hostname = new URL(`http://${req.headers.host}`).hostname;
						if (![
							"127.0.0.1",
							"localhost",
							"[::1]"
						].includes(hostname)) return json(res, 403, { error: "forbidden" });
						if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
						if (req.headers["content-type"]?.split(";")[0] !== "application/json") return json(res, 415, { error: "application/json required" });
						await session.network.save(await readJson$1(req));
						json(res, 200, await session.network.snapshot());
					} catch (error) {
						json(res, 400, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: WEB2API_SETTINGS_PATH,
				handler: async (req, res) => {
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						if (req.method === "GET") return json(res, 200, await session.web2api.read());
						if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
						if (req.headers["content-type"]?.split(";")[0] !== "application/json") return json(res, 415, { error: "application/json required" });
						const saved = await session.web2api.save(await readJson$1(req));
						await notify();
						json(res, 200, saved);
					} catch (error) {
						json(res, 400, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: WEB2API_TEST_PATH,
				handler: async (req, res) => {
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					try {
						const body = await readJson$1(req);
						json(res, 200, await session.web2api.testConnection(body));
					} catch (error) {
						json(res, 400, { error: safeMessage(error) });
					}
				}
			}),
			...["cancel", "retry"].map((action) => ctx.webServer.register({
				kind: "exact",
				path: `/plugins/dsh-antigravity-oauth/auth/${action}`,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						if (action === "cancel") await session.cancel();
						else await session.retryEligibility();
						await notify();
						json(res, 200, {
							ok: true,
							account: await session.snapshot()
						});
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			})),
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_STATUS_PATH,
				handler: async (req, res) => {
					if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					json(res, 200, await session.snapshot());
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_LOGIN_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						const challenge = await session.signIn();
						if (!isSafeAuthUrl(challenge.url)) throw new Error("authorization URL is outside Google accounts");
						json(res, 200, challenge);
						session.waitUntilSettled().then(async () => {
							await notify();
						});
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_COMPLETE_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						const account = await session.complete(codeFrom(await readJson$1(req)));
						await notify();
						json(res, 200, {
							ok: true,
							account
						});
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: ACCOUNT_SWITCH_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						const body = await readJson$1(req);
						const id = typeof body.id === "string" ? body.id : "";
						if (id.length === 0) throw new Error("expected { \"id\": \"...\" }");
						await session.switchAccount(id);
						await notify();
						json(res, 200, {
							ok: true,
							account: await session.snapshot()
						});
					} catch (error) {
						json(res, 400, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: ACCOUNT_REMOVE_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						const body = await readJson$1(req);
						const id = typeof body.id === "string" ? body.id : "";
						if (id.length === 0) throw new Error("expected { \"id\": \"...\" }");
						await session.removeAccount(id);
						await notify();
						json(res, 200, {
							ok: true,
							account: await session.snapshot()
						});
					} catch (error) {
						json(res, 400, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: ACCOUNT_TOGGLE_ARGON_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						const body = await readJson$1(req);
						const id = typeof body.id === "string" ? body.id : "";
						if (id.length === 0) throw new Error("expected { \"id\": \"...\" }");
						const acc = await session.store.get(id);
						if (!acc) throw new Error("account not found");
						const nextVal = acc.hasArgon !== true;
						await session.store.update(id, { hasArgon: nextVal });
						await notify();
						json(res, 200, {
							ok: true,
							hasArgon: nextVal,
							account: await session.snapshot()
						});
					} catch (error) {
						json(res, 400, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: MANAGER_SETTINGS_PATH,
				handler: async (req, res) => {
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						if (req.method === "GET") return json(res, 200, viewOf(await session.manager.read()));
						if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
						if (req.headers["content-type"]?.split(";")[0] !== "application/json") return json(res, 415, { error: "application/json required" });
						const saved = await session.manager.save(await readJson$1(req));
						await notify();
						json(res, 200, viewOf(saved));
					} catch (error) {
						json(res, 400, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: MANAGER_TEST_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						const body = await readJson$1(req);
						const stored = await session.manager.read();
						json(res, 200, await probeBridge({
							baseUrl: body.baseUrl === void 0 ? stored.baseUrl : normalizeBaseUrl(body.baseUrl),
							apiKey: typeof body.apiKey === "string" && body.apiKey.trim().length > 0 ? body.apiKey.trim() : stored.apiKey
						}));
					} catch (error) {
						json(res, 400, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: ACCOUNT_QUOTAS_PATH,
				handler: async (req, res) => {
					if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						json(res, 200, {
							ok: true,
							quotas: await session.retrieveAllQuotas()
						});
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: ADVANCED_SETTINGS_PATH,
				handler: async (req, res) => {
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					if (req.method === "GET") {
						try {
							json(res, 200, {
								ok: true,
								settings: await session.getAdvancedSettings()
							});
						} catch (err) {
							json(res, 500, { error: safeMessage(err) });
						}
						return;
					}
					if (req.method === "POST") {
						try {
							const body = await readJson$1(req);
							const settings = await session.saveAdvancedSettings(body);
							await notify();
							json(res, 200, {
								ok: true,
								settings
							});
						} catch (err) {
							json(res, 500, { error: safeMessage(err) });
						}
						return;
					}
					json(res, 405, { error: "method not allowed" });
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: API_SERVER_PATH,
				handler: async (req, res) => {
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					if (req.method === "GET") {
						try {
							json(res, 200, {
								ok: true,
								settings: await session.apiServerStore.read(),
								status: session.apiServer.getStatus()
							});
						} catch (err) {
							json(res, 500, { error: safeMessage(err) });
						}
						return;
					}
					if (req.method === "POST") {
						try {
							const body = await readJson$1(req);
							json(res, 200, {
								ok: true,
								settings: await session.apiServerStore.save(body),
								status: await session.apiServer.start()
							});
						} catch (err) {
							json(res, 500, { error: safeMessage(err) });
						}
						return;
					}
					json(res, 405, { error: "method not allowed" });
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: AVAILABLE_MODELS_PATH,
				handler: async (req, res) => {
					if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						json(res, 200, {
							ok: true,
							models: await session.getAvailableModels()
						});
					} catch (err) {
						json(res, 500, { error: safeMessage(err) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: AUTH_LOGOUT_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						await session.signOut();
						await notify();
						json(res, 200, { ok: true });
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			})
		];
		return async () => {
			for (const dispose of routes) dispose();
			await session.dispose();
		};
	}, "dsh-antigravity-oauth: Web OAuth routes");
}
//#endregion
//#region src/web2api/types.ts
const DEFAULT_WEB2API_MODELS = [
	{
		id: "gemini-2.5-flash",
		name: "Gemini 2.5 Flash (Web)",
		contextWindow: 1048576,
		maxTokens: 65536
	},
	{
		id: "gemini-2.5-pro",
		name: "Gemini 2.5 Pro (Web)",
		contextWindow: 1048576,
		maxTokens: 65536
	},
	{
		id: "gemini-2.0-flash-thinking-exp",
		name: "Gemini 2.0 Flash Thinking (Web)",
		contextWindow: 1048576,
		maxTokens: 65536
	},
	{
		id: "imagen-3",
		name: "Imagen 3 (Web Image Gen)",
		contextWindow: 8192,
		maxTokens: 2048
	}
];
const DEFAULT_WEB2API_SETTINGS = {
	enabled: false,
	baseUrl: "http://127.0.0.1:18088/v1",
	apiKey: "",
	models: DEFAULT_WEB2API_MODELS.map((m) => m.id),
	enableImageTool: true,
	timeoutMs: 12e4
};
//#endregion
//#region src/web2api/client.ts
/** The gateway sent nothing for the configured idle time. */
var Web2ApiTimeoutError = class extends Error {
	idleMs;
	constructor(idleMs) {
		super(`Web2API sent no data for ${idleMs} ms`);
		this.idleMs = idleMs;
		this.name = "Web2ApiTimeoutError";
	}
};
var Web2ApiClient = class {
	getSettings;
	constructor(getSettings) {
		this.getSettings = getSettings;
	}
	async *streamChat(payload, signal) {
		const settings = await this.getSettings();
		const endpoint = settings.baseUrl.endsWith("/v1") ? `${settings.baseUrl}/chat/completions` : `${settings.baseUrl}/v1/chat/completions`;
		const headers = {
			"Content-Type": "application/json",
			Accept: "text/event-stream"
		};
		if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
		const idleMs = settings.timeoutMs ?? DEFAULT_WEB2API_SETTINGS.timeoutMs ?? 12e4;
		const idle = new AbortController();
		let timer;
		const restartIdleTimer = () => {
			clearTimeout(timer);
			timer = setTimeout(() => idle.abort(new Web2ApiTimeoutError(idleMs)), idleMs);
		};
		const requestSignal = signal === void 0 ? idle.signal : AbortSignal.any([signal, idle.signal]);
		restartIdleTimer();
		try {
			yield* this.readStream(endpoint, headers, payload, requestSignal, restartIdleTimer);
		} catch (error) {
			if (idle.signal.aborted && signal?.aborted !== true) throw idle.signal.reason;
			throw error;
		} finally {
			clearTimeout(timer);
		}
	}
	async *readStream(endpoint, headers, payload, signal, restartIdleTimer) {
		const response = await fetch$1(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify({
				...payload,
				stream: true
			}),
			signal
		});
		restartIdleTimer();
		if (!response.ok) {
			const errText = await response.text().catch(() => "");
			throw new Error(`Web2API error (HTTP ${response.status}): ${errText || response.statusText}`);
		}
		if (!response.body) throw new Error("Web2API returned empty response body");
		const reader = response.body.getReader();
		const decoder = new TextDecoder("utf-8");
		let buffer = "";
		let inThoughtTag = false;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				restartIdleTimer();
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const rawLine of lines) {
					const line = rawLine.trim();
					if (!line || line.startsWith(":")) continue;
					if (line === "data: [DONE]") {
						yield {
							type: "finish",
							reason: "stop"
						};
						return;
					}
					if (line.startsWith("data: ")) {
						const dataStr = line.slice(6).trim();
						try {
							const chunk = JSON.parse(dataStr);
							if (chunk.usage) yield {
								type: "usage",
								promptTokens: chunk.usage.prompt_tokens,
								completionTokens: chunk.usage.completion_tokens,
								totalTokens: chunk.usage.total_tokens
							};
							const choice = chunk.choices?.[0];
							if (!choice) continue;
							const delta = choice.delta;
							if (delta) {
								const thoughtText = delta.reasoning_content ?? delta.thought;
								if (typeof thoughtText === "string" && thoughtText.length > 0) yield {
									type: "thought",
									text: thoughtText
								};
								if (typeof delta.content === "string" && delta.content.length > 0) {
									let text = delta.content;
									while (text.length > 0) if (!inThoughtTag) {
										const tagStart = text.indexOf("<thought>");
										if (tagStart !== -1) {
											const before = text.slice(0, tagStart);
											if (before.length > 0) yield {
												type: "text",
												text: before
											};
											inThoughtTag = true;
											text = text.slice(tagStart + 9);
										} else {
											yield {
												type: "text",
												text
											};
											break;
										}
									} else {
										const tagEnd = text.indexOf("</thought>");
										if (tagEnd !== -1) {
											const thoughtContent = text.slice(0, tagEnd);
											if (thoughtContent.length > 0) yield {
												type: "thought",
												text: thoughtContent
											};
											inThoughtTag = false;
											text = text.slice(tagEnd + 10);
										} else {
											yield {
												type: "thought",
												text
											};
											break;
										}
									}
								}
								if (Array.isArray(delta.tool_calls)) for (const tc of delta.tool_calls) yield {
									type: "tool_call",
									index: tc.index,
									id: tc.id,
									name: tc.function?.name,
									arguments: tc.function?.arguments
								};
							}
							if (choice.finish_reason) yield {
								type: "finish",
								reason: choice.finish_reason
							};
						} catch {}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}
	async generateImage(prompt, signal) {
		const settings = await this.getSettings();
		const endpoint = settings.baseUrl.endsWith("/v1") ? `${settings.baseUrl}/images/generations` : `${settings.baseUrl}/v1/images/generations`;
		const headers = {
			"Content-Type": "application/json",
			Accept: "application/json"
		};
		if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
		const response = await fetch$1(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify({
				prompt,
				model: "imagen-3",
				n: 1,
				size: "1024x1024"
			}),
			signal
		});
		if (!response.ok) {
			const err = await response.text().catch(() => "");
			throw new Error(`Image generation failed (${response.status}): ${err}`);
		}
		const first = (await response.json())?.data?.[0];
		if (first?.url) return first.url;
		if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
		throw new Error("No image returned in response");
	}
};
//#endregion
//#region src/web2api/adapter.ts
const WEB2API_ROUTE = "agy-web";
const IMAGE_ONLY_PROMPT = "See the attached image.";
function textOf(blocks) {
	return blocks.filter((block) => block.type === "text").map((block) => block.text).join("");
}
async function userContentOf(blocks, attachments, signal, resolveAccess) {
	const parts = [];
	for (const block of blocks) {
		if (block.type === "text") {
			if (block.text.length > 0) parts.push({
				type: "text",
				text: block.text
			});
			continue;
		}
		if (block.type === "image") {
			const image = await resolveImageBlock(block, attachments, signal, resolveAccess);
			parts.push(image.type === "inline" ? {
				type: "image_url",
				image_url: { url: `data:${image.mimeType};base64,${image.data}` }
			} : {
				type: "text",
				text: image.text
			});
		}
	}
	const textParts = parts.filter((part) => part.type === "text");
	if (textParts.length === parts.length) return textParts.map((part) => part.text).join("");
	if (textParts.length === 0) parts.unshift({
		type: "text",
		text: IMAGE_ONLY_PROMPT
	});
	return parts;
}
async function convertMessagesToOpenAi(messages, systemPrompt, attachments, signal, resolveAccess) {
	const result = [];
	if (systemPrompt && systemPrompt.trim().length > 0) result.push({
		role: "system",
		content: systemPrompt.trim()
	});
	const newestUser = messages.map((message) => message.role).lastIndexOf("user");
	for (const [index, message] of messages.entries()) if (message.role === "user") {
		const store = index === newestUser ? attachments : void 0;
		result.push({
			role: "user",
			content: await userContentOf(message.content, store, signal, resolveAccess)
		});
	} else if (message.role === "assistant") {
		const text = textOf(message.content);
		result.push({
			role: "assistant",
			content: text
		});
	}
	return result;
}
var Web2ApiAdapter = class extends LlmAdapter {
	getSettings;
	resolveAttachments;
	resolveImageAccess;
	client;
	constructor(getSettings, resolveAttachments, resolveImageAccess) {
		super();
		this.getSettings = getSettings;
		this.resolveAttachments = resolveAttachments;
		this.resolveImageAccess = resolveImageAccess;
		this.client = new Web2ApiClient(getSettings);
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: "Gemini Web (Web2API)"
		};
	}
	async listModels(provider) {
		return (await this.getSettings()).models.map((id) => {
			return {
				provider,
				id,
				name: DEFAULT_WEB2API_MODELS.find((m) => m.id === id)?.name ?? `${id} (Web)`,
				inputModalities: ["text", "image"]
			};
		});
	}
	async resolveModel(provider, model) {
		const predefined = DEFAULT_WEB2API_MODELS.find((m) => m.id === model);
		const contextWindow = predefined?.contextWindow ?? 1048576;
		const maxTokens = predefined?.maxTokens ?? 65536;
		return {
			provider,
			id: model,
			name: predefined?.name ?? `${model} (Web)`,
			inputModalities: ["text", "image"],
			context: { contextWindow },
			defaultMaxTokens: maxTokens,
			reasoning: {
				efforts: [
					{
						id: ReasoningEffortId("low"),
						name: "Low"
					},
					{
						id: ReasoningEffortId("medium"),
						name: "Medium"
					},
					{
						id: ReasoningEffortId("high"),
						name: "High"
					}
				],
				defaultEffort: ReasoningEffortId("medium")
			}
		};
	}
	async *stream(options) {
		if (!(await this.getSettings()).enabled) throw new LlmError("Gemini Web2API is disabled. Enable it in Settings → Antigravity.", "NO_ADAPTER");
		const payload = {
			model: options.model,
			messages: await convertMessagesToOpenAi(options.messages, options.system, this.resolveAttachments?.(), options.signal, this.resolveImageAccess),
			stream: true,
			temperature: options.temperature,
			max_tokens: options.maxTokens
		};
		let currentIndex = 0;
		let currentBlockType;
		let blockOpened = false;
		const closeCurrentBlock = function* () {
			if (blockOpened) {
				currentIndex += 1;
				blockOpened = false;
				currentBlockType = void 0;
			}
		};
		try {
			for await (const event of this.client.streamChat(payload, options.signal)) if (event.type === "thought") {
				if (currentBlockType !== "reasoning") {
					yield* closeCurrentBlock();
					yield {
						type: "block-start",
						index: currentIndex,
						blockType: "reasoning"
					};
					currentBlockType = "reasoning";
					blockOpened = true;
				}
				yield {
					type: "reasoning-delta",
					index: currentIndex,
					text: event.text
				};
			} else if (event.type === "text") {
				if (currentBlockType !== "text") {
					yield* closeCurrentBlock();
					yield {
						type: "block-start",
						index: currentIndex,
						blockType: "text"
					};
					currentBlockType = "text";
					blockOpened = true;
				}
				yield {
					type: "text-delta",
					index: currentIndex,
					text: event.text
				};
			} else if (event.type === "tool_call") {
				yield* closeCurrentBlock();
				const callId = ToolCallId(event.id ?? `call_${currentIndex}`);
				const toolName = event.name ?? "unknown_tool";
				yield {
					type: "block-start",
					index: currentIndex,
					blockType: "tool-call"
				};
				if (event.arguments) yield {
					type: "tool-call-delta",
					index: currentIndex,
					id: callId,
					name: toolName,
					argumentsDelta: event.arguments
				};
				currentIndex += 1;
			} else if (event.type === "usage") yield {
				type: "usage",
				usage: {
					inputTokens: event.promptTokens,
					outputTokens: event.completionTokens
				}
			};
			else if (event.type === "finish") {
				yield* closeCurrentBlock();
				yield {
					type: "finish",
					reason: { kind: "stop" }
				};
			}
		} catch (err) {
			yield* closeCurrentBlock();
			if (err instanceof Web2ApiTimeoutError) throw new LlmError(err.message, "TIMEOUT", { cause: err });
			const message = err instanceof Error ? err.message : String(err);
			throw new LlmError(`Web2API streaming error: ${message}`, "UNKNOWN", { cause: err });
		}
	}
};
//#endregion
//#region src/envelope.ts
const INT63_MASK = (1n << 63n) - 1n;
const RANDOM_BOUND = 9000000000000000000n;
const WIRE_PROFILES = {
	"gemini-4-argon-low": { maxOutputTokens: 65536 },
	"gemini-4-argon-medium": { maxOutputTokens: 65536 },
	"gemini-4-argon-high": { maxOutputTokens: 65536 },
	"gemini-3.5-flash-extra-low": {
		modelEnum: "MODEL_PLACEHOLDER_M187",
		maxOutputTokens: 65536
	},
	"gemini-3.5-flash-low": {
		modelEnum: "MODEL_PLACEHOLDER_M20",
		maxOutputTokens: 65536
	},
	"gemini-3-flash-agent": {
		modelEnum: "MODEL_PLACEHOLDER_M132",
		maxOutputTokens: 65536
	},
	"gemini-3.7-flash-low": { maxOutputTokens: 65536 },
	"gemini-3.7-flash-medium": { maxOutputTokens: 65536 },
	"gemini-3.7-flash-high": { maxOutputTokens: 65536 },
	"gemini-3.8-flash-low": { maxOutputTokens: 65536 },
	"gemini-3.8-flash-medium": { maxOutputTokens: 65536 },
	"gemini-3.8-flash-high": { maxOutputTokens: 65536 }
};
function formatSignedDecimal(value) {
	return `-${value.toString()}`;
}
function randomSignedDecimalSessionId() {
	while (true) {
		const bytes = randomBytes(8);
		let value = 0n;
		for (const byte of bytes) value = value << 8n | BigInt(byte);
		value &= INT63_MASK;
		if (value < RANDOM_BOUND) return formatSignedDecimal(value);
	}
}
function createCcaSession(endpoint = DAILY_ENDPOINT) {
	return {
		agentId: randomUUID(),
		trajectoryId: randomUUID(),
		stepIndex: 1,
		sessionId: randomSignedDecimalSessionId(),
		lastGoodEndpoint: endpoint
	};
}
function advanceEnvelope(session, wireModelId, now = Date.now(), lastExecutionId) {
	session.stepIndex += 1;
	const step = session.stepIndex;
	const profile = WIRE_PROFILES[wireModelId];
	const labels = {
		last_step_index: String(step - 1),
		trajectory_id: session.trajectoryId
	};
	if (lastExecutionId !== void 0 && lastExecutionId.length > 0) labels.last_execution_id = lastExecutionId;
	if (profile?.modelEnum !== void 0) labels.model_enum = profile.modelEnum;
	return {
		requestId: `agent/${session.agentId}/${now}/${session.trajectoryId}/${step}`,
		labels,
		sessionId: session.sessionId,
		step
	};
}
function streamGenerateContentUrl(endpoint) {
	return `${endpoint.replace(/\/+$/, "")}/v1internal:streamGenerateContent?alt=sse`;
}
function systemInstruction(text, role) {
	return role === void 0 ? { parts: [{ text }] } : {
		role,
		parts: [{ text }]
	};
}
function functionTools(functions) {
	if (functions.length === 0) return [{ googleSearch: {} }];
	return [{ functionDeclarations: functions.map((tool) => ({
		name: tool.name,
		description: tool.description,
		parametersJsonSchema: tool.parameters
	})) }];
}
function wrap(projectId, model, request, envelope) {
	return {
		project: projectId,
		model,
		request: {
			...request,
			sessionId: envelope.sessionId,
			labels: envelope.labels
		},
		requestType: "agent",
		userAgent: "antigravity",
		requestId: envelope.requestId
	};
}
function buildChatBody(projectId, input, envelope) {
	const generationConfig = { maxOutputTokens: WIRE_PROFILES[input.model]?.maxOutputTokens ?? 65536 };
	if (input.thinkingLevel !== void 0) generationConfig.thinkingConfig = {
		includeThoughts: true,
		thinkingLevel: input.thinkingLevel
	};
	else generationConfig.thinkingConfig = { includeThoughts: true };
	const tools = functionTools(input.functions);
	const request = {
		contents: input.contents,
		generationConfig,
		tools,
		toolConfig: { functionCallingConfig: { mode: "VALIDATED" } }
	};
	if (input.system !== void 0 && input.system.length > 0) request.systemInstruction = systemInstruction(input.system, "user");
	return wrap(projectId, input.model, request, envelope);
}
function detachedRequestId(now = Date.now()) {
	return `agent/${randomUUID()}/${now}/${randomUUID()}/2`;
}
function buildSearchBody(projectId, input, now = Date.now()) {
	const generationConfig = { maxOutputTokens: WIRE_PROFILES[input.model]?.maxOutputTokens ?? 65536 };
	if (input.thinkingLevel !== void 0) generationConfig.thinkingConfig = {
		includeThoughts: true,
		thinkingLevel: input.thinkingLevel
	};
	else generationConfig.thinkingConfig = { includeThoughts: true };
	return {
		project: projectId,
		model: input.model,
		request: {
			contents: [{
				role: "user",
				parts: [{ text: input.query }]
			}],
			generationConfig,
			tools: [{ googleSearch: {} }]
		},
		requestType: "agent",
		userAgent: "antigravity",
		requestId: detachedRequestId(now)
	};
}
function buildCcaBody(projectId, input, envelope) {
	if (input.kind === "search") return buildSearchBody(projectId, input);
	return buildChatBody(projectId, input, envelope);
}
//#endregion
//#region src/sse.ts
function dataPayload(block) {
	const lines = [];
	for (const line of block.split(/\r?\n/)) if (line.startsWith("data:")) lines.push(line.slice(5).trimStart());
	if (lines.length === 0) return void 0;
	return lines.join("\n");
}
async function* readSseJson(stream, signal) {
	const decoder = new TextDecoderStream();
	const reader = stream.pipeThrough(decoder).getReader();
	let buffer = "";
	try {
		while (true) {
			if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : /* @__PURE__ */ new Error("aborted");
			const { done, value } = await reader.read();
			if (value !== void 0) buffer += value;
			const parts = buffer.split(/\r?\n\r?\n/);
			buffer = done ? "" : parts.pop() ?? "";
			const blocks = done && parts.length === 0 && buffer.length > 0 ? [buffer] : parts;
			if (done && parts.length > 0 && buffer.length > 0) blocks.push(buffer);
			for (const block of blocks) {
				const payload = dataPayload(block);
				if (payload === void 0 || payload.length === 0 || payload === "[DONE]") continue;
				yield JSON.parse(payload);
			}
			if (done) return;
		}
	} finally {
		reader.releaseLock();
	}
}
function usageFrom(raw) {
	if (!isRecord(raw)) return void 0;
	const input = typeof raw.promptTokenCount === "number" ? raw.promptTokenCount : 0;
	const output = typeof raw.candidatesTokenCount === "number" ? raw.candidatesTokenCount : 0;
	const reasoning = typeof raw.thoughtsTokenCount === "number" ? raw.thoughtsTokenCount : void 0;
	const cache = typeof raw.cachedContentTokenCount === "number" ? raw.cachedContentTokenCount : void 0;
	return {
		inputTokens: input,
		outputTokens: output,
		...reasoning === void 0 ? {} : { reasoningTokens: reasoning },
		...cache === void 0 || cache === 0 ? {} : { cacheReadTokens: cache }
	};
}
function parseCcaChunk(raw) {
	if (!isRecord(raw)) return [];
	if (isRecord(raw.error)) {
		const message = typeof raw.error.message === "string" ? raw.error.message : JSON.stringify(raw.error);
		const code = typeof raw.error.code === "number" ? raw.error.code : void 0;
		return [{
			type: "error",
			message,
			...code === void 0 ? {} : { code }
		}];
	}
	const response = isRecord(raw.response) ? raw.response : raw;
	if (!isRecord(response)) return [];
	const events = [];
	const usage = usageFrom(response.usageMetadata);
	if (usage !== void 0) events.push({
		type: "usage",
		usage
	});
	const responseId = typeof response.responseId === "string" ? response.responseId : void 0;
	const candidates = Array.isArray(response.candidates) ? response.candidates : [];
	let finishReason;
	for (const candidate of candidates) {
		if (!isRecord(candidate)) continue;
		if (typeof candidate.finishReason === "string") finishReason = candidate.finishReason;
		const content = isRecord(candidate.content) ? candidate.content : void 0;
		const parts = content !== void 0 && Array.isArray(content.parts) ? content.parts : [];
		let lastThoughtSignature;
		for (const part of parts) {
			if (!isRecord(part)) continue;
			const partSignature = typeof part.thoughtSignature === "string" && part.thoughtSignature.length > 0 ? part.thoughtSignature : void 0;
			if (part.thought === true && typeof part.text === "string") {
				if (partSignature !== void 0) lastThoughtSignature = partSignature;
				events.push({
					type: "thought",
					text: part.text
				});
			} else if (typeof part.text === "string" && part.text.length > 0) events.push({
				type: "text",
				text: part.text
			});
			if (isRecord(part.functionCall) && typeof part.functionCall.name === "string") {
				const args = isRecord(part.functionCall.args) ? part.functionCall.args : {};
				const callSignature = typeof part.functionCall.thoughtSignature === "string" && part.functionCall.thoughtSignature.length > 0 ? part.functionCall.thoughtSignature : partSignature ?? lastThoughtSignature;
				events.push({
					type: "functionCall",
					name: part.functionCall.name,
					args,
					...typeof part.functionCall.id === "string" ? { id: part.functionCall.id } : {},
					...callSignature === void 0 ? {} : { thoughtSignature: callSignature }
				});
			}
			if (isRecord(part.inlineData) && typeof part.inlineData.data === "string" && typeof part.inlineData.mimeType === "string") events.push({
				type: "inlineImage",
				mimeType: part.inlineData.mimeType,
				data: part.inlineData.data
			});
		}
	}
	if (finishReason !== void 0) events.push({
		type: "finish",
		reason: finishReason,
		...responseId === void 0 ? {} : { responseId }
	});
	return events;
}
//#endregion
//#region src/user-agent.ts
let discoveredVersion;
let inFlight;
function parseAntigravityManifestVersion(yamlText) {
	for (const line of yamlText.split(/\r?\n/)) {
		const match = /^\s*version\s*:\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))\s*(?:#.*)?$/.exec(line);
		if (match === null) continue;
		const version = (match[1] ?? match[2] ?? match[3] ?? "").trim();
		return /^\d+\.\d+\.\d+$/.test(version) ? version : void 0;
	}
}
function getAntigravityVersion() {
	return process.env.DSH_ANTIGRAVITY_VERSION || discoveredVersion || "2.29.0";
}
function antigravityUserAgent(version = getAntigravityVersion()) {
	const cl = process.env.DSH_ANTIGRAVITY_CL || "963137146";
	return `antigravity/hub/${version} (aidev_client; os_type=${process.env.DSH_ANTIGRAVITY_OS || "darwin"}; arch=${process.env.DSH_ANTIGRAVITY_ARCH || "arm64"}; cl=${cl})`;
}
function ensureAntigravityVersion(fetcher = fetch, signal) {
	if (process.env.DSH_ANTIGRAVITY_VERSION || discoveredVersion !== void 0) return Promise.resolve();
	if (inFlight !== void 0) return inFlight;
	inFlight = (async () => {
		try {
			const timeout = AbortSignal.timeout(5e3);
			const response = await fetcher(ANTIGRAVITY_VERSION_MANIFEST_URL, {
				headers: {
					"Cache-Control": "no-cache",
					"User-Agent": "electron-builder"
				},
				signal: signal === void 0 ? timeout : AbortSignal.any([signal, timeout])
			});
			if (response.ok) discoveredVersion = parseAntigravityManifestVersion(await response.text());
		} catch {} finally {
			if (discoveredVersion === void 0) inFlight = void 0;
		}
	})();
	return inFlight;
}
//#endregion
//#region src/cca-client.ts
var CcaHttpError = class extends Error {
	status;
	constructor(status, body) {
		super(`CCA ${status}: ${body.slice(0, 800)}`);
		this.name = "CcaHttpError";
		this.status = status;
	}
};
function classifyStatus(status) {
	if (status === 401 || status === 403) return "auth";
	if (status === 429 || status >= 500) return "retry";
	return "fail";
}
var CcaClient = class {
	session;
	fetchImpl;
	userAgent;
	now;
	lastExecutionId;
	constructor(options) {
		this.session = options.session;
		this.fetchImpl = options.fetch ?? envProxyFetch;
		this.userAgent = options.userAgent ?? antigravityUserAgent;
		this.now = options.now ?? Date.now;
	}
	async *chat(oauth, input, signal) {
		yield* this.generate(oauth, input, signal);
	}
	async *search(oauth, input, signal) {
		yield* this.generate(oauth, input, signal);
	}
	endpoints() {
		const last = this.session.lastGoodEndpoint;
		const rest = CCA_ENDPOINTS.filter((endpoint) => endpoint !== last);
		return last.length > 0 ? [last, ...rest] : [...CCA_ENDPOINTS];
	}
	headers(access) {
		return {
			Authorization: `Bearer ${access}`,
			"Content-Type": "application/json",
			Accept: "text/event-stream",
			"User-Agent": this.userAgent()
		};
	}
	async *generate(oauth, input, signal) {
		const body = input.kind === "search" ? buildSearchBody(oauth.projectId, input, this.now()) : buildChatBody(oauth.projectId, input, advanceEnvelope(this.session, input.model, this.now(), this.lastExecutionId));
		const endpoints = this.endpoints();
		let lastError;
		const isolated = isolateAbort(signal);
		try {
			for (let index = 0; index < endpoints.length; index += 1) {
				const endpoint = endpoints[index];
				const url = streamGenerateContentUrl(endpoint);
				try {
					const response = await this.fetchImpl(url, {
						method: "POST",
						headers: this.headers(oauth.access),
						body: JSON.stringify(body),
						signal: isolated.signal
					});
					if (!response.ok) {
						const text = await response.text();
						const error = new CcaHttpError(response.status, text);
						if (classifyStatus(response.status) === "retry" && index < endpoints.length - 1) {
							lastError = error;
							continue;
						}
						throw error;
					}
					if (response.body === null) throw new Error("CCA stream had no body");
					this.session.lastGoodEndpoint = endpoint;
					let sawFinish = false;
					for await (const raw of readSseJson(response.body, isolated.signal)) {
						const events = parseCcaChunk(raw);
						for (const event of events) {
							if (event.type === "finish" && event.responseId !== void 0) {
								if (input.kind === "chat") this.lastExecutionId = event.responseId;
								sawFinish = true;
							}
							if (event.type === "error") throw new Error(event.message);
							yield event;
						}
					}
					if (!sawFinish) yield {
						type: "finish",
						reason: "STOP"
					};
					return;
				} catch (error) {
					lastError = error instanceof Error ? error : new Error(String(error));
					if (signal?.aborted) throw lastError;
					if (index === endpoints.length - 1) throw lastError;
				}
			}
			throw lastError ?? /* @__PURE__ */ new Error("CCA request failed");
		} finally {
			isolated.dispose();
		}
	}
};
function isolateAbort(signal) {
	if (signal === void 0) return { dispose() {} };
	const local = new AbortController();
	const onAbort = () => {
		local.abort();
	};
	if (signal.aborted) local.abort();
	else signal.addEventListener("abort", onAbort);
	return {
		signal: local.signal,
		dispose: () => {
			signal.removeEventListener("abort", onAbort);
		}
	};
}
//#endregion
//#region src/oauth.ts
const CLIENT_ID = atob("MTA3MTAwNjA2MDU5MS10bWhzc2luMmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlcC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==");
const CLIENT_SECRET = atob("R09DU1BYLUs1OEZXUjQ4NkxkTEoxbUxCOHNYQzR6NnFEQWY=");
const SCOPES = [
	"https://www.googleapis.com/auth/cloud-platform",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
	"https://www.googleapis.com/auth/cclog",
	"https://www.googleapis.com/auth/experimentsandconfigs"
];
const LOAD_CODE_ASSIST_BODY = Object.freeze({ metadata: { ideType: "ANTIGRAVITY" } });
function newOAuthState() {
	return randomBytes(16).toString("hex");
}
function authorizationUrl(state, redirectUri = CALLBACK_URI) {
	const params = new URLSearchParams({
		client_id: CLIENT_ID,
		response_type: "code",
		redirect_uri: redirectUri,
		scope: SCOPES.join(" "),
		state,
		access_type: "offline",
		prompt: "select_account consent"
	});
	return `${AUTH_URL}?${params.toString()}`;
}
function extractOAuthCode(raw) {
	const trimmed = raw.trim();
	if (trimmed.includes("://") || trimmed.includes("?")) {
		const url = new URL(trimmed);
		const code = url.searchParams.get("code");
		if (code === null || code.length === 0) throw new Error("authorization response is missing code");
		const state = url.searchParams.get("state");
		return state === null ? { code } : {
			code,
			state
		};
	}
	if (trimmed.length === 0) throw new Error("authorization code is empty");
	return { code: trimmed };
}
function parseTokenPayload(raw, filename) {
	if (!isRecord(raw)) throw new Error(`${filename} token response must be an object`);
	if (typeof raw.access_token !== "string" || raw.access_token.length === 0) throw new Error(`${filename} token response is missing access_token`);
	if (typeof raw.expires_in !== "number" || !Number.isFinite(raw.expires_in)) throw new Error(`${filename} token response is missing expires_in`);
	return {
		access_token: raw.access_token,
		expires_in: raw.expires_in,
		...typeof raw.refresh_token === "string" ? { refresh_token: raw.refresh_token } : {}
	};
}
async function readJson(response, label) {
	const text = await response.text();
	if (!response.ok) throw new Error(`${label} failed: ${response.status} ${response.statusText}: ${text.slice(0, 800)}`);
	if (text.length === 0) return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`${label} returned invalid JSON`);
	}
}
async function exchangeAuthorizationCode(code, redirectUri = CALLBACK_URI, fetcher = fetch, now = Date.now()) {
	const payload = parseTokenPayload(await readJson(await fetcher(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			code,
			grant_type: "authorization_code",
			redirect_uri: redirectUri
		})
	}), "token exchange"), "token exchange");
	if (payload.refresh_token === void 0 || payload.refresh_token.length === 0) throw new Error("No refresh token received. Please try again.");
	return {
		type: "oauth",
		access: payload.access_token,
		refresh: payload.refresh_token,
		expires: now + payload.expires_in * 1e3 - OAUTH_EXPIRES_SKEW_MS
	};
}
async function refreshAccessToken(current, fetcher = fetch, now = Date.now()) {
	const payload = parseTokenPayload(await readJson(await fetcher(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			refresh_token: current.refresh,
			grant_type: "refresh_token"
		})
	}), "token refresh"), "token refresh");
	return {
		type: "oauth",
		access: payload.access_token,
		refresh: payload.refresh_token ?? current.refresh,
		expires: now + payload.expires_in * 1e3 - OAUTH_EXPIRES_SKEW_MS,
		projectId: current.projectId,
		...current.email === void 0 ? {} : { email: current.email }
	};
}
async function fetchUserEmail(accessToken, fetcher = fetch) {
	try {
		const response = await fetcher(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
		if (!response.ok) return void 0;
		const payload = await response.json();
		return isRecord(payload) && typeof payload.email === "string" ? payload.email : void 0;
	} catch {
		return;
	}
}
function assistHeaders(accessToken) {
	return {
		Authorization: `Bearer ${accessToken}`,
		"Content-Type": "application/json",
		"User-Agent": antigravityUserAgent()
	};
}
function parseLoadCodeAssist(payload) {
	if (!isRecord(payload)) throw new Error("loadCodeAssist response must be an object");
	const project = isRecord(payload.cloudaicompanionProject) ? payload.cloudaicompanionProject.id : payload.cloudaicompanionProject;
	const projectId = typeof project === "string" && project.length > 0 ? project : void 0;
	const hasCurrentTier = isRecord(payload.currentTier) || isRecord(payload.paidTier);
	const allowed = Array.isArray(payload.allowedTiers) ? payload.allowedTiers.some((tier) => isRecord(tier) && tier.id === "free-tier") : false;
	const ineligible = Array.isArray(payload.ineligibleTiers) ? payload.ineligibleTiers.find((tier) => isRecord(tier) && tier.tierId === "free-tier") : void 0;
	const ineligibility = isRecord(ineligible) && typeof ineligible.reasonMessage === "string" ? {
		reasonMessage: ineligible.reasonMessage,
		...typeof ineligible.validationUrl === "string" && ineligible.validationUrl.length > 0 ? { validationUrl: ineligible.validationUrl } : {}
	} : void 0;
	const tiers = Array.isArray(payload.allowedTiers) ? payload.allowedTiers.filter(isRecord) : [];
	const preferred = tiers.find((tier) => tier.isDefault === true) ?? tiers.find((tier) => tier.id === "free-tier");
	return {
		projectId,
		hasCurrentTier,
		freeTierAllowed: allowed,
		defaultTier: typeof preferred?.id === "string" && preferred.id.length > 0 ? preferred.id : void 0,
		ineligibility
	};
}
async function postLoadCodeAssist(accessToken, fetcher, signal) {
	return parseLoadCodeAssist(await readJson(await fetcher(`${DAILY_ENDPOINT}${LOAD_CODE_ASSIST_PATH}`, {
		method: "POST",
		headers: assistHeaders(accessToken),
		body: JSON.stringify(LOAD_CODE_ASSIST_BODY),
		signal
	}), "loadCodeAssist"));
}
async function onboardUser(accessToken, tierId, fetcher, signal) {
	const deadline = Date.now() + ONBOARD_TIMEOUT_MS;
	const remaining = () => {
		const left = deadline - Date.now();
		if (left <= 0) throw new Error(`onboardUser timed out after ${ONBOARD_TIMEOUT_MS}ms`);
		return left;
	};
	const headers = assistHeaders(accessToken);
	let response = await fetcher(`${DAILY_ENDPOINT}${ONBOARD_USER_PATH}`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			tierId,
			metadata: LOAD_CODE_ASSIST_BODY.metadata
		}),
		signal: signal === void 0 ? AbortSignal.timeout(remaining()) : AbortSignal.any([signal, AbortSignal.timeout(remaining())])
	});
	let payload = await readJson(response, "onboardUser");
	while (true) {
		if (!isRecord(payload)) throw new Error("onboardUser response must be an object");
		if (payload.done === true) {
			if (payload.error !== void 0 && payload.error !== null) {
				const error = isRecord(payload.error) ? payload.error : {};
				const message = typeof error.message === "string" ? error.message : JSON.stringify(payload.error);
				throw new Error(`OnboardUser operation failed: ${message}`);
			}
			if (payload.response === void 0 || payload.response === null) throw new Error("failed to unmarshal OnboardUserResponse");
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, Math.min(ONBOARD_POLL_INTERVAL_MS, remaining())));
		const name = typeof payload.name === "string" ? payload.name : "";
		if (name.length === 0) throw new Error("onboardUser returned an operation without a name");
		response = await fetcher(`${DAILY_ENDPOINT}/v1internal/${name}`, {
			method: "GET",
			headers,
			signal: signal === void 0 ? AbortSignal.timeout(remaining()) : AbortSignal.any([signal, AbortSignal.timeout(remaining())])
		});
		payload = await readJson(response, "onboardUser operation");
	}
}
async function discoverProject(accessToken, fetcher = fetch, signal, observe) {
	const initial = await postLoadCodeAssist(accessToken, fetcher, signal);
	observe?.({
		hasProject: initial.projectId !== void 0,
		hasCurrentTier: initial.hasCurrentTier,
		freeTierAllowed: initial.freeTierAllowed,
		defaultTier: initial.defaultTier,
		rejected: initial.ineligibility !== void 0
	});
	if (initial.hasCurrentTier && initial.projectId !== void 0) return initial.projectId;
	if (!initial.hasCurrentTier && initial.defaultTier === void 0 && initial.ineligibility !== void 0) {
		const extra = initial.ineligibility.validationUrl === void 0 ? "" : `\n${initial.ineligibility.validationUrl}`;
		throw new Error(`${initial.ineligibility.reasonMessage}${extra}`);
	}
	if (!initial.hasCurrentTier) {
		if (initial.defaultTier === void 0) throw new Error("Antigravity did not advertise an eligible default tier");
		await onboardUser(accessToken, initial.defaultTier, fetcher, signal);
	}
	const refreshed = await postLoadCodeAssist(accessToken, fetcher, signal);
	if (refreshed.projectId !== void 0) return refreshed.projectId;
	throw new Error("loadCodeAssist did not return a cloudaicompanionProject");
}
async function completeOAuthLogin(code, fetcher = fetch, now = Date.now(), signal, onAuthorized, observe) {
	const tokens = await exchangeAuthorizationCode(code, CALLBACK_URI, fetcher, now);
	signal?.throwIfAborted();
	await onAuthorized?.(tokens);
	const email = await fetchUserEmail(tokens.access, fetcher);
	signal?.throwIfAborted();
	await onAuthorized?.({
		...tokens,
		...email === void 0 ? {} : { email }
	});
	const projectId = await discoverProject(tokens.access, fetcher, signal, observe);
	signal?.throwIfAborted();
	return {
		...tokens,
		projectId,
		...email === void 0 ? {} : { email }
	};
}
//#endregion
//#region src/web2api/store.ts
function sanitizeWeb2ApiSettings(raw) {
	if (typeof raw !== "object" || raw === null) return { ...DEFAULT_WEB2API_SETTINGS };
	const data = raw;
	const enabled = Boolean(data.enabled);
	let baseUrl = typeof data.baseUrl === "string" && data.baseUrl.trim().length > 0 ? data.baseUrl.trim().replace(/\/+$/, "") : DEFAULT_WEB2API_SETTINGS.baseUrl;
	const apiKey = typeof data.apiKey === "string" ? data.apiKey.trim() : "";
	const models = Array.isArray(data.models) ? data.models.filter((m) => typeof m === "string" && m.trim().length > 0) : [...DEFAULT_WEB2API_SETTINGS.models];
	const enableImageTool = data.enableImageTool !== false;
	const timeoutMs = typeof data.timeoutMs === "number" && data.timeoutMs > 0 ? data.timeoutMs : DEFAULT_WEB2API_SETTINGS.timeoutMs;
	return {
		enabled,
		baseUrl,
		apiKey,
		models: models.length > 0 ? models : [...DEFAULT_WEB2API_SETTINGS.models],
		enableImageTool,
		timeoutMs
	};
}
var AntigravityWeb2ApiStore = class {
	filename;
	constructor(filename) {
		this.filename = filename;
	}
	async read() {
		try {
			const text = await readFile(this.filename, "utf-8");
			return sanitizeWeb2ApiSettings(JSON.parse(text));
		} catch {
			return { ...DEFAULT_WEB2API_SETTINGS };
		}
	}
	async save(settings) {
		const sanitized = sanitizeWeb2ApiSettings(settings);
		await writeFileAtomic(this.filename, JSON.stringify(sanitized, null, 2) + "\n", {
			mode: 384,
			dirMode: 448
		});
		return sanitized;
	}
	async testConnection(settings) {
		const target = sanitizeWeb2ApiSettings(settings);
		const start = Date.now();
		try {
			const endpoint = target.baseUrl.endsWith("/v1") ? `${target.baseUrl}/models` : `${target.baseUrl}/v1/models`;
			const headers = { Accept: "application/json" };
			if (target.apiKey) headers.Authorization = `Bearer ${target.apiKey}`;
			const res = await fetch$1(endpoint, {
				method: "GET",
				headers,
				signal: AbortSignal.timeout(1e4)
			});
			const latencyMs = Date.now() - start;
			if (!res.ok) return {
				ok: false,
				latencyMs,
				error: `HTTP ${res.status}: ${res.statusText}`
			};
			const body = await res.json();
			return {
				ok: true,
				latencyMs,
				models: Array.isArray(body?.data) ? body.data.map((m) => m.id).filter((id) => typeof id === "string") : void 0
			};
		} catch (err) {
			return {
				ok: false,
				latencyMs: Date.now() - start,
				error: err instanceof Error ? err.message : String(err)
			};
		}
	}
};
//#endregion
//#region src/api-server/server.ts
function sendJson(res, status, data) {
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Access-Control-Allow-Origin": "*"
	});
	res.end(JSON.stringify(data));
}
function sendError(res, status, message, type = "invalid_request_error", code) {
	sendJson(res, status, { error: {
		message,
		type,
		...code ? { code } : {}
	} });
}
async function readBodyJson(req) {
	const chunks = [];
	let totalLength = 0;
	for await (const chunk of req) {
		const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		totalLength += buf.length;
		if (totalLength > 31457280) throw new Error("Request payload too large (>30MB)");
		chunks.push(buf);
	}
	if (chunks.length === 0) return {};
	const raw = Buffer.concat(chunks).toString("utf-8");
	return JSON.parse(raw);
}
function parseOpenAiMessages(rawMessages) {
	const contents = [];
	const systemParts = [];
	for (const msg of rawMessages) {
		if (!msg || typeof msg !== "object") continue;
		const role = msg.role;
		if (role === "system") {
			const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
			if (text.trim().length > 0) systemParts.push(text.trim());
			continue;
		}
		if (role === "user") {
			const parts = [];
			if (typeof msg.content === "string") {
				if (msg.content.length > 0) parts.push({ text: msg.content });
			} else if (Array.isArray(msg.content)) for (const part of msg.content) {
				if (!part || typeof part !== "object") continue;
				if (part.type === "text" && typeof part.text === "string") parts.push({ text: part.text });
				else if (part.type === "image_url" && part.image_url?.url) {
					const match = String(part.image_url.url).match(/^data:([^;]+);base64,(.+)$/);
					if (match && match[1] && match[2]) parts.push({ inlineData: {
						mimeType: match[1],
						data: match[2]
					} });
				}
			}
			if (parts.length > 0) contents.push({
				role: "user",
				parts
			});
			continue;
		}
		if (role === "assistant") {
			const parts = [];
			if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) for (const tc of msg.tool_calls) {
				const fn = tc.function;
				let args = {};
				try {
					args = typeof fn?.arguments === "string" ? JSON.parse(fn.arguments) : fn?.arguments || {};
				} catch {
					args = {};
				}
				parts.push({ functionCall: {
					id: tc.id,
					name: fn?.name || "function",
					args
				} });
			}
			if (typeof msg.content === "string" && msg.content.length > 0) parts.push({ text: msg.content });
			if (parts.length > 0) contents.push({
				role: "model",
				parts
			});
			continue;
		}
		if (role === "tool") {
			const toolCallId = msg.tool_call_id || msg.name || "tool";
			const toolName = msg.name || "tool";
			const resultText = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
			contents.push({
				role: "user",
				parts: [{ functionResponse: {
					id: toolCallId,
					name: toolName,
					response: { result: resultText }
				} }]
			});
			continue;
		}
	}
	return {
		system: systemParts.length > 0 ? systemParts.join("\n\n") : void 0,
		contents
	};
}
function parseOpenAiTools(rawTools) {
	if (!Array.isArray(rawTools)) return [];
	const declarations = [];
	for (const item of rawTools) if (item?.type === "function" && item.function?.name) declarations.push({
		name: item.function.name,
		description: item.function.description || "",
		parameters: item.function.parameters || {
			type: "object",
			properties: {}
		}
	});
	return declarations;
}
var AntigravityApiServer = class {
	session;
	store;
	server = null;
	status = {
		running: false,
		host: "127.0.0.1",
		port: 18045
	};
	constructor(session, store) {
		this.session = session;
		this.store = store;
	}
	getStatus() {
		return { ...this.status };
	}
	async start() {
		const settings = await this.store.read();
		if (!settings.enabled) {
			await this.stop();
			return this.getStatus();
		}
		if (this.server) await this.stop();
		for (let attempt = 0;; attempt++) {
			const status = await this.listen(settings);
			if (status.running || !/EADDRINUSE/.test(status.error ?? "") || attempt >= 5) return status;
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	listen(settings) {
		return new Promise((resolve) => {
			const srv = createServer((req, res) => {
				this.handleRequest(req, res, settings);
			});
			srv.once("error", (err) => {
				this.status = {
					running: false,
					host: settings.host,
					port: settings.port,
					error: err.message
				};
				resolve(this.getStatus());
			});
			srv.listen(settings.port, settings.host, () => {
				this.server = srv;
				this.status = {
					running: true,
					host: settings.host,
					port: settings.port
				};
				resolve(this.getStatus());
			});
		});
	}
	async stop() {
		if (this.server) {
			const srv = this.server;
			const closed = new Promise((resolve) => srv.close(() => resolve()));
			srv.closeIdleConnections();
			const force = setTimeout(() => srv.closeAllConnections(), 2e3);
			await closed;
			clearTimeout(force);
			this.server = null;
		}
		const settings = await this.store.read().catch(() => ({
			host: "127.0.0.1",
			port: 18045
		}));
		this.status = {
			running: false,
			host: settings.host,
			port: settings.port
		};
	}
	async getEffectiveEnabledModels() {
		try {
			const adv = await this.session.getAdvancedSettings();
			if (Array.isArray(adv?.enabledModels) && adv.enabledModels.length > 0) return adv.enabledModels;
		} catch {}
		return ["gemini-3.8-flash"];
	}
	authenticate(req, configuredKey) {
		if (!configuredKey || configuredKey.trim().length === 0) return true;
		const authHeader = req.headers["authorization"];
		if (authHeader) {
			const match = authHeader.match(/^Bearer\s+(.+)$/i);
			if (match && match[1] === configuredKey) return true;
		}
		const xApiKey = req.headers["x-api-key"];
		if (xApiKey && xApiKey === configuredKey) return true;
		return false;
	}
	async handleRequest(req, res, settings) {
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}
		const pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname.replace(/\/+$/, "");
		if (pathname === "" || pathname === "/health") {
			sendJson(res, 200, {
				status: "ok",
				version: "dsh-antigravity-oauth-api-server",
				models: await this.getEffectiveEnabledModels()
			});
			return;
		}
		if (!this.authenticate(req, settings.apiKey)) {
			sendError(res, 401, "Incorrect API key provided.", "invalid_request_error", "invalid_api_key");
			return;
		}
		if (req.method === "GET" && pathname === "/v1/models") {
			sendJson(res, 200, {
				object: "list",
				data: (await this.getEffectiveEnabledModels()).map((id) => ({
					id,
					object: "model",
					created: 17e8,
					owned_by: "antigravity"
				}))
			});
			return;
		}
		if (req.method === "POST" && pathname === "/v1/chat/completions") {
			await this.handleChatCompletions(req, res);
			return;
		}
		sendError(res, 404, `Not Found: ${req.method} ${pathname}`, "invalid_request_error");
	}
	async handleChatCompletions(req, res) {
		let body;
		try {
			body = await readBodyJson(req);
		} catch (err) {
			sendError(res, 400, err.message || "Invalid JSON in request body");
			return;
		}
		const modelName = body.model;
		if (!modelName || typeof modelName !== "string") {
			sendError(res, 400, "Missing or invalid \"model\" parameter.");
			return;
		}
		const enabledModels = await this.getEffectiveEnabledModels();
		if (!isPublicModelId(modelName) || !enabledModels.includes(modelName)) {
			sendError(res, 400, `The model '${modelName}' does not exist or is not enabled in Antigravity settings.`, "invalid_request_error", "model_not_found");
			return;
		}
		if (!Array.isArray(body.messages) || body.messages.length === 0) {
			sendError(res, 400, "Missing or empty \"messages\" parameter.");
			return;
		}
		const publicId = modelName;
		const { system, contents } = parseOpenAiMessages(body.messages);
		const functions = parseOpenAiTools(body.tools);
		let adv;
		try {
			adv = await this.session.getAdvancedSettings();
		} catch {}
		const effort = adv?.defaultReasoningEffort ?? "medium";
		const wireModel = routeChatModel(publicId, effort);
		const thinkingLevel = thinkingLevelFor(publicId, effort);
		const input = {
			kind: "chat",
			model: wireModel,
			contents,
			...system ? { system } : {},
			functions,
			...thinkingLevel ? { thinkingLevel } : {}
		};
		let lease;
		try {
			lease = await this.session.acquire({ model: publicId });
		} catch (err) {
			sendError(res, 503, `Failed to acquire Antigravity account: ${err.message}`, "server_error", "account_acquire_failed");
			return;
		}
		if (!lease) {
			sendError(res, 503, "No available Antigravity account. Please sign in via DSH settings.", "server_error", "no_available_account");
			return;
		}
		const abortController = new AbortController();
		req.on("close", () => {
			abortController.abort();
		});
		const isStream = Boolean(body.stream);
		const requestId = randomUUID();
		const createdTime = Math.floor(Date.now() / 1e3);
		try {
			const ccaStream = lease.cca.chat(lease.oauth, input, abortController.signal);
			if (isStream) {
				res.writeHead(200, {
					"Content-Type": "text/event-stream; charset=utf-8",
					"Cache-Control": "no-cache, no-transform",
					Connection: "keep-alive",
					"Access-Control-Allow-Origin": "*"
				});
				res.write(`data: ${JSON.stringify({
					id: `chatcmpl-${requestId}`,
					object: "chat.completion.chunk",
					created: createdTime,
					model: modelName,
					choices: [{
						index: 0,
						delta: { role: "assistant" },
						finish_reason: null
					}]
				})}\n\n`);
				for await (const event of ccaStream) if (event.type === "thought") res.write(`data: ${JSON.stringify({
					id: `chatcmpl-${requestId}`,
					object: "chat.completion.chunk",
					created: createdTime,
					model: modelName,
					choices: [{
						index: 0,
						delta: { reasoning_content: event.text },
						finish_reason: null
					}]
				})}\n\n`);
				else if (event.type === "text") res.write(`data: ${JSON.stringify({
					id: `chatcmpl-${requestId}`,
					object: "chat.completion.chunk",
					created: createdTime,
					model: modelName,
					choices: [{
						index: 0,
						delta: { content: event.text },
						finish_reason: null
					}]
				})}\n\n`);
				else if (event.type === "functionCall") res.write(`data: ${JSON.stringify({
					id: `chatcmpl-${requestId}`,
					object: "chat.completion.chunk",
					created: createdTime,
					model: modelName,
					choices: [{
						index: 0,
						delta: { tool_calls: [{
							index: 0,
							id: event.id || `call_${Date.now()}`,
							type: "function",
							function: {
								name: event.name,
								arguments: JSON.stringify(event.args)
							}
						}] },
						finish_reason: null
					}]
				})}\n\n`);
				else if (event.type === "finish") res.write(`data: ${JSON.stringify({
					id: `chatcmpl-${requestId}`,
					object: "chat.completion.chunk",
					created: createdTime,
					model: modelName,
					choices: [{
						index: 0,
						delta: {},
						finish_reason: "stop"
					}]
				})}\n\n`);
				res.write("data: [DONE]\n\n");
				res.end();
			} else {
				let content = "";
				let reasoningContent = "";
				const toolCalls = [];
				let lastUsage;
				for await (const event of ccaStream) if (event.type === "text") content += event.text;
				else if (event.type === "thought") reasoningContent += event.text;
				else if (event.type === "functionCall") toolCalls.push({
					id: event.id || `call_${Date.now()}`,
					type: "function",
					function: {
						name: event.name,
						arguments: JSON.stringify(event.args)
					}
				});
				else if (event.type === "usage") lastUsage = event.usage;
				sendJson(res, 200, {
					id: `chatcmpl-${requestId}`,
					object: "chat.completion",
					created: createdTime,
					model: modelName,
					choices: [{
						index: 0,
						message: {
							role: "assistant",
							content,
							...reasoningContent.length > 0 ? { reasoning_content: reasoningContent } : {},
							...toolCalls.length > 0 ? { tool_calls: toolCalls } : {}
						},
						finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop"
					}],
					usage: {
						prompt_tokens: lastUsage?.inputTokens || 0,
						completion_tokens: lastUsage?.outputTokens || 0,
						total_tokens: (lastUsage?.inputTokens || 0) + (lastUsage?.outputTokens || 0)
					}
				});
			}
		} catch (err) {
			if (!res.headersSent) sendError(res, 500, err.message || "Upstream CCA generation error", "upstream_error");
			else res.end();
		}
	}
};
//#endregion
//#region src/api-server/types.ts
const DEFAULT_API_SERVER_SETTINGS = {
	enabled: false,
	host: DEFAULT_API_SERVER_HOST,
	port: DEFAULT_API_SERVER_PORT,
	apiKey: ""
};
//#endregion
//#region src/api-server/store.ts
function generateApiKey() {
	return `sk-agy-${randomBytes(16).toString("hex")}`;
}
function sanitizeApiServerSettings(raw) {
	if (typeof raw !== "object" || raw === null) return {
		...DEFAULT_API_SERVER_SETTINGS,
		apiKey: generateApiKey()
	};
	const data = raw;
	const enabled = Boolean(data.enabled);
	const host = typeof data.host === "string" && data.host.trim().length > 0 ? data.host.trim() : DEFAULT_API_SERVER_HOST;
	const rawPort = Number(data.port);
	return {
		enabled,
		host,
		port: Number.isInteger(rawPort) && rawPort >= 1024 && rawPort <= 65535 ? rawPort : DEFAULT_API_SERVER_PORT,
		apiKey: typeof data.apiKey === "string" && data.apiKey.trim().length > 0 ? data.apiKey.trim() : generateApiKey()
	};
}
var AntigravityApiServerStore = class {
	filename;
	constructor(filename) {
		this.filename = filename;
	}
	async read() {
		try {
			const text = await readFile(this.filename, "utf-8");
			return sanitizeApiServerSettings(JSON.parse(text));
		} catch {
			return sanitizeApiServerSettings(null);
		}
	}
	async save(settings) {
		const sanitized = sanitizeApiServerSettings(settings);
		await writeFileAtomic(this.filename, JSON.stringify(sanitized, null, 2) + "\n", {
			mode: 384,
			dirMode: 448
		});
		return sanitized;
	}
};
//#endregion
//#region src/quota-core.ts
/**
* Formats relative countdown string in exact parity across frontend and backend.
*/
function formatShortCountdown(isoString, lang = "zh") {
	if (!isoString) return "-";
	const deadline = new Date(isoString).getTime();
	if (!Number.isFinite(deadline)) return "-";
	const diff = deadline - Date.now();
	if (diff <= 0) return lang === "zh" ? "已到重置时间" : "Reset due";
	const totalMinutes = Math.floor(diff / 6e4);
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor(totalMinutes % 1440 / 60);
	const mins = totalMinutes % 60;
	if (lang === "zh") {
		if (days > 0) return hours > 0 ? `${days}天${hours}小时` : `${days}天`;
		if (hours > 0) return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`;
		return `${mins}分`;
	}
	if (days > 0) return hours > 0 ? `${days}d${hours}h` : `${days}d`;
	if (hours > 0) return `${hours}h${String(mins).padStart(2, "0")}m`;
	return `${mins}m`;
}
/**
* Evaluates raw Google CCA quota groups and extracts Gemini core metrics.
* Strictly isolates Gemini family buckets to eliminate false 100% 3P readings.
*/
function evaluateQuotaMetrics(quota, lang = "zh") {
	if (!quota?.ok || !quota.groups) return void 0;
	const allBuckets = quota.groups.flatMap((g) => g.buckets);
	const geminiBuckets = allBuckets.filter((b) => /^gemini[-_]/i.test(b.bucketId || ""));
	const b5h = geminiBuckets.find((b) => b.window === "5h") ?? allBuckets.find((b) => b.window === "5h" && !/^3p[-_]/i.test(b.bucketId || ""));
	const bWeekly = geminiBuckets.find((b) => b.window === "weekly") ?? allBuckets.find((b) => b.window === "weekly" && !/^3p[-_]/i.test(b.bucketId || ""));
	if (!b5h && !bWeekly) return void 0;
	const f5h = b5h?.remainingFraction;
	const fWeekly = bWeekly?.remainingFraction;
	const p5h = f5h !== void 0 ? Math.round(f5h * 100) : void 0;
	const pWeekly = fWeekly !== void 0 ? Math.round(fWeekly * 100) : void 0;
	const score = Math.min(f5h !== void 0 ? f5h * 100 : 100, fWeekly !== void 0 ? fWeekly * 100 : 100);
	return {
		b5h,
		bWeekly,
		p5h,
		pWeekly,
		isExhausted: score <= 10 || (b5h ? f5h !== void 0 ? f5h <= 0 : false : true) && (bWeekly ? fWeekly !== void 0 ? fWeekly <= 0 : false : true),
		score,
		reset5h: b5h?.resetTime ? formatShortCountdown(b5h.resetTime, lang) : "",
		resetWeekly: bWeekly?.resetTime ? formatShortCountdown(bWeekly.resetTime, lang) : ""
	};
}
//#endregion
//#region src/session.ts
function html(ok, authorized = false) {
	return `<!doctype html><html><head><meta charset="utf-8"><title>${ok ? "Signed in" : authorized ? "Google authorized" : "Sign-in failed"}</title></head><body><p>${ok ? "You can close this window and return to DeepSeek Harness." : authorized ? "Google authorization is saved. Return to DeepSeek Harness to check Antigravity service eligibility." : "Authorization failed. Return to DeepSeek Harness and try again."}</p></body></html>`;
}
var ThoughtSignatureStore = class {
	signatures = /* @__PURE__ */ new Map();
	filename;
	saveTimer;
	constructor(filename) {
		this.filename = filename;
		this.load();
	}
	load() {
		try {
			if (existsSync(this.filename)) {
				const raw = JSON.parse(readFileSync(this.filename, "utf8"));
				if (raw && typeof raw === "object") {
					for (const [k, v] of Object.entries(raw)) if (typeof v === "string") this.signatures.set(k, v);
				}
			}
		} catch {}
	}
	get(id) {
		return this.signatures.get(id);
	}
	set(id, signature) {
		this.signatures.set(id, signature);
		if (this.signatures.size > 5e3) {
			const first = this.signatures.keys().next().value;
			if (first !== void 0) this.signatures.delete(first);
		}
		this.scheduleSave();
		return this;
	}
	has(id) {
		return this.signatures.has(id);
	}
	delete(id) {
		const res = this.signatures.delete(id);
		if (res) this.scheduleSave();
		return res;
	}
	clear() {
		this.signatures.clear();
		this.scheduleSave();
	}
	get size() {
		return this.signatures.size;
	}
	forEach(callbackfn, thisArg) {
		this.signatures.forEach((v, k) => callbackfn.call(thisArg, v, k, this));
	}
	[Symbol.iterator]() {
		return this.signatures[Symbol.iterator]();
	}
	entries() {
		return this.signatures.entries();
	}
	keys() {
		return this.signatures.keys();
	}
	values() {
		return this.signatures.values();
	}
	scheduleSave() {
		if (this.saveTimer) return;
		this.saveTimer = setTimeout(() => {
			this.saveTimer = void 0;
			try {
				const obj = Object.fromEntries(this.signatures);
				writeFileAtomic(this.filename, `${JSON.stringify(obj)}\n`, {
					mode: 384,
					dirMode: 448
				}).catch(() => {});
			} catch {}
		}, 1e3);
	}
};
var AntigravitySession = class {
	store;
	thoughtSignatures;
	network;
	web2api;
	apiServerStore;
	manager;
	apiServer;
	fetchImpl;
	runtimes = /* @__PURE__ */ new Map();
	precheckAt = /* @__PURE__ */ new Map();
	precheckInFlight = /* @__PURE__ */ new Map();
	refreshAttempts = /* @__PURE__ */ new Map();
	login = { status: "idle" };
	operation;
	cancellation;
	listening;
	pendingUrl;
	pendingState;
	callbackServer;
	serviceError;
	completing = false;
	eligibility;
	constructor(store, fetchImpl) {
		this.store = store;
		this.network = new AntigravityNetwork(store.filename + ".network.json");
		this.web2api = new AntigravityWeb2ApiStore(store.filename + ".web2api.json");
		this.apiServerStore = new AntigravityApiServerStore(store.filename + ".api-server.json");
		this.manager = new AntigravityManagerStore(join(dirname(store.filename), MANAGER_FILENAME));
		this.fetchImpl = fetchImpl ?? this.network.fetch;
		this.thoughtSignatures = new ThoughtSignatureStore(store.filename + ".signatures.json");
		this.apiServer = new AntigravityApiServer(this, this.apiServerStore);
	}
	runtimeFor(accountId) {
		let runtime = this.runtimes.get(accountId);
		if (runtime === void 0) {
			runtime = { cca: new CcaClient({
				session: createCcaSession(),
				fetch: this.fetchImpl
			}) };
			this.runtimes.set(accountId, runtime);
		}
		return runtime;
	}
	isArgonCapable(account) {
		return account.hasArgon === true && this.runtimes.get(account.id)?.argonIneligible !== true;
	}
	noteArgonRejected(accountId) {
		this.runtimeFor(accountId).argonIneligible = true;
	}
	async findArgonAccount(exclude) {
		const excluded = typeof exclude === "string" ? /* @__PURE__ */ new Set([exclude]) : exclude;
		const all = await this.store.list();
		const requireExplicit = all.some((account) => account.hasArgon === true);
		const now = Date.now();
		const available = all.filter((account) => {
			if (account.projectId === void 0) return false;
			if (account.hasArgon === false) return false;
			if (requireExplicit && account.hasArgon !== true) return false;
			if (excluded?.has(account.id)) return false;
			const runtime = this.runtimes.get(account.id);
			if (runtime?.dead) return false;
			if (runtime?.argonIneligible) return false;
			if (runtime?.limitedUntil !== void 0 && runtime.limitedUntil > now) return false;
			return true;
		});
		if (available.length === 0) return void 0;
		const active = await this.store.active();
		if (excluded && excluded.size > 0) return (active !== void 0 ? available.find((a) => a.id === active.id) : void 0) ?? available[0];
		const adv = await this.getAdvancedSettings().catch(() => ({
			switchingStrategy: "failover_429",
			proactiveThreshold: 20
		}));
		return this.selectAccountForStrategy(available, active, adv.switchingStrategy, adv.proactiveThreshold);
	}
	async selectAccountForStrategy(candidates, active, strategy, threshold) {
		if (candidates.length === 0) return void 0;
		if (candidates.length === 1) return candidates[0];
		if (strategy === "manual") return (active !== void 0 ? candidates.find((a) => a.id === active.id) : void 0) ?? candidates[0];
		if (strategy === "round_robin") {
			const activeIndex = active !== void 0 ? candidates.findIndex((a) => a.id === active.id) : -1;
			const offset = this.roundRobinCursor++ % candidates.length;
			return candidates[(activeIndex + 1 + offset) % candidates.length];
		}
		if (strategy === "proactive_threshold") {
			const activeMatch = active !== void 0 ? candidates.find((a) => a.id === active.id) : void 0;
			if (activeMatch !== void 0) {
				try {
					const summaries = await this.retrieveAllQuotas();
					const activeSummary = summaries[activeMatch.id];
					const currentScore = (activeSummary?.ok && activeSummary.groups ? evaluateQuotaMetrics(activeSummary) : void 0)?.score ?? 100;
					if (currentScore < threshold) {
						let bestAccount = candidates.find((a) => a.id !== activeMatch.id);
						let bestScore = -1;
						for (const cand of candidates) {
							if (cand.id === activeMatch.id) continue;
							const s = summaries[cand.id];
							const m = s?.ok && s.groups ? evaluateQuotaMetrics(s)?.score ?? 50 : 50;
							if (m > bestScore) {
								bestScore = m;
								bestAccount = cand;
							}
						}
						if (bestAccount !== void 0 && bestScore > currentScore) {
							await Promise.resolve(this.store.setActive(bestAccount.id)).catch(() => {});
							return bestAccount;
						}
					}
				} catch {}
				return activeMatch;
			}
		}
		return (active !== void 0 ? candidates.find((a) => a.id === active.id) : void 0) ?? candidates[0];
	}
	async acquire(options) {
		if (options?.model === "gemini-4-argon") {
			const excluded = /* @__PURE__ */ new Set();
			while (true) {
				const argonAccount = await this.findArgonAccount(excluded);
				if (argonAccount === void 0) break;
				const lease = await this.acquireForAccount(argonAccount.id);
				if (lease !== void 0) return lease;
				excluded.add(argonAccount.id);
			}
			const explicitArgon = (await this.store.list()).filter((a) => a.projectId !== void 0 && a.hasArgon === true);
			for (const candidate of explicitArgon) {
				if (excluded.has(candidate.id)) continue;
				const lease = await this.acquireForAccount(candidate.id);
				if (lease !== void 0) return lease;
			}
			if (explicitArgon.length > 0) return void 0;
		}
		const all = await this.store.list();
		const active = await this.store.active();
		const now = Date.now();
		const readyAccounts = all.filter((account) => {
			if (account.projectId === void 0) return false;
			const runtime = this.runtimes.get(account.id);
			if (runtime?.dead) return false;
			if (runtime?.limitedUntil !== void 0 && runtime.limitedUntil > now) return false;
			return true;
		});
		const adv = await this.getAdvancedSettings().catch(() => ({
			switchingStrategy: "failover_429",
			proactiveThreshold: 20
		}));
		const excluded = /* @__PURE__ */ new Set();
		while (true) {
			const candidates = readyAccounts.filter((a) => !excluded.has(a.id));
			if (candidates.length === 0) break;
			const selectedAccount = await this.selectAccountForStrategy(candidates, active, adv.switchingStrategy, adv.proactiveThreshold);
			if (selectedAccount === void 0) break;
			const grant = await this.refreshGrantForAccount(selectedAccount.id);
			if (grant !== void 0 && grant.projectId !== void 0) {
				const runtime = this.runtimeFor(selectedAccount.id);
				return {
					oauth: {
						...grant,
						projectId: grant.projectId
					},
					accountId: selectedAccount.id,
					...grant.email === void 0 ? {} : { email: grant.email },
					cca: runtime.cca
				};
			}
			excluded.add(selectedAccount.id);
		}
	}
	async acquireForAccount(accountId) {
		const grant = await this.refreshGrantForAccount(accountId);
		if (grant === void 0 || grant.projectId === void 0) return void 0;
		const runtime = this.runtimeFor(accountId);
		return {
			oauth: {
				...grant,
				projectId: grant.projectId
			},
			accountId,
			...grant.email === void 0 ? {} : { email: grant.email },
			cca: runtime.cca
		};
	}
	/**
	* Find the account with the best remaining quota (optionally excluding one account or filtering by min threshold).
	* Inspired by ~/.dsh/scripts/antigravity_quota.mjs.
	*/
	async findBestAccount(options) {
		const ready = (await this.store.list()).filter((a) => a.projectId !== void 0 && a.id !== options?.excludeId);
		if (ready.length === 0) return void 0;
		const now = Date.now();
		const available = ready.filter((account) => {
			const runtime = this.runtimes.get(account.id);
			if (runtime?.dead) return false;
			if (runtime?.limitedUntil !== void 0 && runtime.limitedUntil > now) return false;
			return true;
		});
		if (available.length <= 1) return available[0];
		try {
			const summaries = await this.retrieveAllQuotas();
			const scores = /* @__PURE__ */ new Map();
			for (const acc of available) {
				const q = summaries[acc.id];
				if (!q?.ok || !q.groups) {
					scores.set(acc.id, 50);
					continue;
				}
				const metrics = evaluateQuotaMetrics(q);
				scores.set(acc.id, metrics?.score ?? 50);
			}
			available.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
			const best = available[0];
			if (options?.minScore !== void 0 && (scores.get(best.id) ?? 0) < options.minScore) return;
			return best;
		} catch {
			return available[0];
		}
	}
	async findFailoverAccount(excludeAccountId, now = Date.now()) {
		return (await this.store.list()).find((account) => {
			if (account.id === excludeAccountId) return false;
			if (account.projectId === void 0) return false;
			const runtime = this.runtimes.get(account.id);
			if (runtime?.dead === true) return false;
			if (runtime?.limitedUntil !== void 0 && runtime.limitedUntil > now) return false;
			return true;
		});
	}
	async hasReadyAccount() {
		return (await this.store.list()).some((account) => account.projectId !== void 0);
	}
	noteRateLimited(accountId) {
		const runtime = this.runtimeFor(accountId);
		runtime.limitedStrikes = (runtime.limitedStrikes ?? 0) + 1;
		const cooldown = Math.min(RATE_LIMIT_COOLDOWN_MS * 2 ** (runtime.limitedStrikes - 1), RATE_LIMIT_COOLDOWN_MAX_MS);
		runtime.limitedUntil = Date.now() + cooldown;
	}
	noteAuthRejected(accountId) {
		this.runtimeFor(accountId).dead = true;
	}
	async snapshot() {
		const accounts = await this.summarizeAccounts();
		if (this.login.status === "signing-in") return {
			status: "signing-in",
			...this.login.url === void 0 ? {} : { url: this.login.url },
			accounts
		};
		if (this.login.status === "error" && accounts.length === 0) return {
			status: "error",
			message: this.login.message,
			accounts
		};
		const active = await this.store.active();
		if (active === void 0) return {
			status: "signed-out",
			accounts: []
		};
		const ready = active.projectId !== void 0;
		const message = this.serviceError ?? (ready ? void 0 : "Google authorization saved. Check Antigravity service eligibility to continue.");
		return {
			status: "signed-in",
			activeId: active.id,
			accounts,
			...message === void 0 ? {} : { message }
		};
	}
	async summarizeAccounts() {
		const all = await this.store.list();
		const active = await this.store.active();
		const now = Date.now();
		for (const account of all) {
			if (account.id === active?.id) continue;
			if (account.expires >= now - 9e5) continue;
			if ((this.precheckAt.get(account.id) ?? 0) > now - 864e5) continue;
			this.precheckAt.set(account.id, now);
			if (this.precheckInFlight.has(account.id)) continue;
			const task = this.precheckAccount(account.id).finally(() => {
				this.precheckInFlight.delete(account.id);
			});
			this.precheckInFlight.set(account.id, task);
		}
		return all.map((account) => {
			const runtime = this.runtimes.get(account.id);
			return {
				id: account.id,
				...account.email === void 0 ? {} : { email: account.email },
				...account.projectId === void 0 ? {} : { projectId: account.projectId },
				...Number.isNaN(account.expires) ? {} : { expiresAt: new Date(account.expires).toISOString() },
				ready: account.projectId !== void 0,
				limited: runtime?.limitedUntil !== void 0 && runtime.limitedUntil > now,
				dead: runtime?.dead === true,
				...account.hasArgon === void 0 ? {} : { hasArgon: account.hasArgon }
			};
		});
	}
	async precheckAccount(accountId) {
		try {
			const grant = await this.store.get(accountId);
			if (grant === void 0) return;
			const next = await refreshAccessToken(grant, this.fetchImpl);
			await this.store.update(accountId, {
				access: next.access,
				refresh: next.refresh,
				expires: next.expires
			});
			const runtime = this.runtimes.get(accountId);
			if (runtime !== void 0) runtime.dead = false;
		} catch (error) {
			if (/invalid_grant/i.test(safeMessage(error))) this.runtimeFor(accountId).dead = true;
		}
	}
	async credential() {
		const grant = await this.store.active();
		return grant?.projectId === void 0 ? void 0 : {
			...grant,
			projectId: grant.projectId
		};
	}
	async refreshIfNeeded(now = Date.now()) {
		const grant = await this.refreshGrant(now);
		return grant?.projectId === void 0 ? void 0 : {
			...grant,
			projectId: grant.projectId
		};
	}
	async refreshGrant(now = Date.now()) {
		const current = await this.store.active();
		if (current === void 0) return void 0;
		return this.refreshGrantForAccount(current.id, now);
	}
	async refreshGrantForAccount(accountId, now = Date.now()) {
		const target = await this.store.get(accountId);
		if (target === void 0) return void 0;
		if (now < target.expires - 9e5) return target;
		if (now - (this.refreshAttempts.get(target.id) ?? 0) < 3e5) return target;
		this.refreshAttempts.set(target.id, now);
		try {
			const next = await refreshAccessToken(target, this.fetchImpl, now);
			return await this.store.update(target.id, {
				access: next.access,
				refresh: next.refresh,
				expires: next.expires
			});
		} catch (error) {
			if (/invalid_grant/i.test(safeMessage(error))) this.runtimeFor(target.id).dead = true;
			return target;
		}
	}
	async switchAccount(accountId) {
		await this.store.setActive(accountId);
		return this.snapshot();
	}
	async removeAccount(accountId) {
		await this.store.remove(accountId);
		this.runtimes.delete(accountId);
		this.precheckAt.delete(accountId);
		this.refreshAttempts.delete(accountId);
		return this.snapshot();
	}
	async signIn() {
		if (this.operation === void 0) this.startLogin();
		try {
			await this.listening;
		} catch {
			await this.operation?.catch(() => void 0);
		}
		if (this.pendingUrl !== void 0 && this.login.status === "signing-in") return { url: this.pendingUrl };
		await this.operation?.catch(() => void 0);
		if (this.pendingUrl !== void 0 && this.login.status === "signing-in") return { url: this.pendingUrl };
		if (this.login.status === "error") throw new Error(this.login.message);
		throw new Error("login did not produce an authorization URL");
	}
	async waitUntilSettled() {
		await this.operation?.catch(() => void 0);
	}
	async complete(raw) {
		if (!this.pendingState || this.completing) throw new Error("Start a new login before submitting a callback");
		const extracted = extractOAuthCode(raw);
		if (this.pendingState !== void 0 && extracted.state !== void 0 && extracted.state !== this.pendingState) throw new Error("OAuth state mismatch");
		const signal = this.cancellation.signal;
		this.completing = true;
		try {
			await this.finishCode(extracted.code, signal);
		} finally {
			this.cancellation?.abort(/* @__PURE__ */ new Error("Antigravity login completed"));
			await this.waitUntilSettled();
			this.completing = false;
		}
		return this.snapshot();
	}
	async finishCode(code, signal) {
		this.serviceError = void 0;
		try {
			const loginFetch = (input, init) => this.fetchImpl(input, {
				...init,
				signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal
			});
			const credential = await completeOAuthLogin(code, loginFetch, Date.now(), signal, async (grant) => {
				signal.throwIfAborted();
				await this.store.add(grant);
			}, (summary) => {
				this.eligibility = summary;
			});
			signal.throwIfAborted();
			await this.store.add(credential);
			this.login = { status: "idle" };
		} catch (error) {
			if (signal.aborted) return;
			this.serviceError = safeMessage(error);
			const accounts = await this.store.list();
			if (accounts.length === 0) {
				this.login = {
					status: "error",
					message: this.serviceError
				};
				return;
			}
			if ((await this.store.active())?.projectId === void 0) {
				const ready = accounts.find((account) => account.projectId !== void 0);
				if (ready !== void 0) await this.store.setActive(ready.id);
			}
			this.login = { status: "idle" };
		}
	}
	async retryEligibility() {
		if (this.operation) throw new Error("Cancel the active login before retrying eligibility");
		const cancellation = new AbortController();
		this.cancellation = cancellation;
		this.operation = (async () => {
			try {
				const active = await this.store.active();
				const grant = await this.refreshGrant();
				if (active === void 0 || grant === void 0) throw new Error("Sign in to Google first");
				const projectId = await discoverProject(grant.access, this.fetchImpl, cancellation.signal, (summary) => {
					this.eligibility = summary;
				});
				cancellation.signal.throwIfAborted();
				await this.store.update(active.id, { projectId });
				this.serviceError = void 0;
			} catch (error) {
				if (!cancellation.signal.aborted) this.serviceError = safeMessage(error);
			}
		})();
		try {
			await this.operation;
		} finally {
			this.operation = void 0;
			this.cancellation = void 0;
		}
		return this.snapshot();
	}
	async cancel() {
		this.cancellation?.abort(/* @__PURE__ */ new Error("Antigravity login cancelled"));
		await this.operation?.catch(() => void 0);
		await this.stopCallbackServer();
		this.pendingUrl = void 0;
		this.pendingState = void 0;
		this.login = { status: "idle" };
	}
	async signOut() {
		this.cancellation?.abort(/* @__PURE__ */ new Error("Antigravity login cancelled"));
		await this.operation?.catch(() => void 0);
		await this.stopCallbackServer();
		const active = await this.store.active();
		if (active !== void 0) {
			await this.store.remove(active.id);
			this.runtimes.delete(active.id);
			this.precheckAt.delete(active.id);
			this.refreshAttempts.delete(active.id);
		}
		this.login = { status: "idle" };
		this.pendingUrl = void 0;
		this.pendingState = void 0;
		this.operation = void 0;
		this.cancellation = void 0;
		this.listening = void 0;
	}
	async dispose() {
		this.cancellation?.abort(/* @__PURE__ */ new Error("Antigravity plugin disposed"));
		await this.operation?.catch(() => void 0);
		await this.stopCallbackServer();
		this.operation = void 0;
		this.cancellation = void 0;
		this.listening = void 0;
		await this.apiServer.stop().catch(() => void 0);
		await this.network.dispose();
	}
	startLogin() {
		const cancellation = new AbortController();
		this.cancellation = cancellation;
		const state = newOAuthState();
		this.pendingState = state;
		const url = authorizationUrl(state);
		if (!isSafeAuthUrl(url)) {
			this.login = {
				status: "error",
				message: "authorization URL is outside Google accounts"
			};
			return;
		}
		this.pendingUrl = url;
		this.login = {
			status: "signing-in",
			url
		};
		ensureAntigravityVersion(this.fetchImpl, cancellation.signal);
		let markListening = () => void 0;
		let failListening = () => void 0;
		this.listening = new Promise((resolve, reject) => {
			markListening = resolve;
			failListening = reject;
		});
		this.operation = this.runLogin(state, cancellation.signal, markListening, failListening);
		this.operation.finally(() => {
			this.operation = void 0;
		});
	}
	async runLogin(state, signal, markListening, failListening) {
		try {
			const hit = await this.listenForCallback(state, signal, markListening, failListening);
			try {
				this.completing = true;
				await this.finishCode(hit.code, signal);
				const snapshot = await this.snapshot();
				const activeAccount = snapshot.status === "signed-in" ? snapshot.accounts.find((account) => account.id === snapshot.activeId) : void 0;
				hit.reply(activeAccount?.ready === true, snapshot.status === "signed-in");
			} catch (error) {
				hit.reply(false, false);
				throw error;
			}
		} catch (error) {
			if (signal.aborted) return;
			this.login = {
				status: "error",
				message: safeMessage(error)
			};
			console.error("[dsh-antigravity-oauth] login failed:", safeMessage(error));
		} finally {
			this.cancellation = void 0;
			this.completing = false;
			this.listening = void 0;
			this.pendingUrl = void 0;
			this.pendingState = void 0;
			await this.stopCallbackServer();
		}
	}
	listenForCallback(state, signal, onListening, onListenError) {
		return new Promise((resolve, reject) => {
			let settled = false;
			const fail = (error) => {
				const err = error instanceof Error ? error : new Error(String(error));
				if (!settled) {
					settled = true;
					reject(err);
				}
			};
			const server = createServer((req, res) => {
				try {
					const requestUrl = new URL(req.url ?? "/", CALLBACK_URI);
					if (requestUrl.pathname !== "/oauth-callback") {
						res.writeHead(404, { "content-type": "text/plain" });
						res.end("not found");
						return;
					}
					const oauthError = requestUrl.searchParams.get("error");
					if (oauthError !== null && oauthError.length > 0) {
						if (!res.writableEnded) {
							res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
							res.end(html(false));
						}
						const description = requestUrl.searchParams.get("error_description");
						fail(new Error(description !== null && description.length > 0 ? `${oauthError}: ${description}` : oauthError));
						return;
					}
					const code = requestUrl.searchParams.get("code");
					const returnedState = requestUrl.searchParams.get("state");
					if (code === null || code.length === 0 || returnedState !== state) {
						if (!res.writableEnded) {
							res.writeHead(404, { "content-type": "text/plain" });
							res.end("not found");
						}
						return;
					}
					if (settled || this.completing) {
						if (!res.writableEnded) {
							res.writeHead(409, { "content-type": "text/plain" });
							res.end("already handled");
						}
						return;
					}
					settled = true;
					resolve({
						code,
						reply: (ok, authorized) => {
							if (res.writableEnded) return;
							res.writeHead(ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
							res.end(html(ok, authorized));
						}
					});
				} catch (error) {
					fail(error);
				}
			});
			this.callbackServer = server;
			const onAbort = () => {
				this.stopCallbackServer();
				fail(signal.reason instanceof Error ? signal.reason : /* @__PURE__ */ new Error("login cancelled"));
			};
			signal.addEventListener("abort", onAbort, { once: true });
			server.once("error", (error) => {
				onListenError(error);
				fail(error);
			});
			server.listen(CALLBACK_PORT, "127.0.0.1", onListening);
		});
	}
	async stopCallbackServer() {
		const server = this.callbackServer;
		this.callbackServer = void 0;
		if (server === void 0) return;
		await new Promise((resolve) => {
			server.close(() => resolve());
		});
	}
	cachedAdvanced;
	cachedQuotas;
	roundRobinCursor = 0;
	async getAdvancedSettings() {
		if (this.cachedAdvanced) return this.cachedAdvanced;
		this.cachedAdvanced = await this.store.getAdvanced();
		return this.cachedAdvanced;
	}
	async saveAdvancedSettings(settings) {
		const saved = await this.store.setAdvanced(settings);
		this.cachedAdvanced = saved;
		return saved;
	}
	async retrieveAllQuotas(options) {
		if (options?.force !== true && this.cachedQuotas && Date.now() - this.cachedQuotas.timestamp < 6e4) return this.cachedQuotas.data;
		const accounts = await this.store.list();
		const result = {};
		await Promise.all(accounts.map(async (account) => {
			try {
				let access = account.access;
				if (account.expires <= Date.now() + 6e4) {
					const refreshed = await refreshAccessToken(account, this.fetchImpl);
					await this.store.update(account.id, {
						access: refreshed.access,
						refresh: refreshed.refresh,
						expires: refreshed.expires
					});
					access = refreshed.access;
				}
				const body = JSON.stringify({ project: account.projectId || "aicode-consumers" });
				let data;
				for (const endpoint of CCA_ENDPOINTS) try {
					const resp = await this.fetchImpl(`${endpoint}${QUOTA_SUMMARY_PATH}`, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${access}`,
							"Content-Type": "application/json",
							"User-Agent": antigravityUserAgent()
						},
						body,
						signal: AbortSignal.timeout(5e3)
					});
					if (resp.ok) {
						data = await resp.json();
						break;
					}
				} catch {}
				if (data && typeof data === "object" && "groups" in data && Array.isArray(data.groups)) {
					const groups = data.groups.map((g) => ({
						displayName: typeof g.displayName === "string" ? g.displayName : "",
						description: typeof g.description === "string" ? g.description : void 0,
						buckets: Array.isArray(g.buckets) ? g.buckets.map((b) => ({
							bucketId: String(b.bucketId ?? ""),
							displayName: typeof b.displayName === "string" ? b.displayName : void 0,
							window: String(b.window ?? ""),
							remainingFraction: typeof b.remainingFraction === "number" ? b.remainingFraction : 1,
							resetTime: typeof b.resetTime === "string" ? b.resetTime : void 0,
							description: typeof b.description === "string" ? b.description : void 0
						})) : []
					}));
					result[account.id] = {
						accountId: account.id,
						email: account.email,
						ok: true,
						groups
					};
				} else result[account.id] = {
					accountId: account.id,
					email: account.email,
					ok: false,
					error: "Quota response invalid"
				};
			} catch (err) {
				result[account.id] = {
					accountId: account.id,
					email: account.email,
					ok: false,
					error: safeMessage(err)
				};
			}
		}));
		this.cachedQuotas = {
			timestamp: Date.now(),
			data: result
		};
		return result;
	}
	availableModelsCache;
	availableModelsFailedAt = 0;
	availableModelsInflight;
	/**
	* The model picker calls this often. A failed upstream fetch backs off for a minute, and
	* concurrent callers share one fetch, so a flaky upstream never stalls every model lookup.
	*/
	async getAvailableModels() {
		const now = Date.now();
		const fallback = () => this.availableModelsCache?.models ?? [...DEFAULT_CATALOG_MODELS];
		if (this.availableModelsCache && now - this.availableModelsCache.fetchedAt < 3e5) return this.availableModelsCache.models;
		if (now - this.availableModelsFailedAt < 6e4) return fallback();
		this.availableModelsInflight ??= (async () => {
			try {
				const fetched = await this.fetchAvailableModelsFromUpstream().catch(() => null);
				if (fetched && fetched.length > 0) {
					this.availableModelsCache = {
						models: fetched,
						fetchedAt: Date.now()
					};
					return fetched;
				}
				this.availableModelsFailedAt = Date.now();
				return fallback();
			} finally {
				this.availableModelsInflight = void 0;
			}
		})();
		return this.availableModelsInflight;
	}
	async fetchAvailableModelsFromUpstream() {
		const active = await this.store.active() ?? (await this.store.list())[0];
		if (!active) return null;
		let access = active.access;
		if (Date.now() >= active.expires - 3e4) try {
			const refreshed = await refreshAccessToken(active, this.fetchImpl);
			await this.store.update(active.id, {
				access: refreshed.access,
				refresh: refreshed.refresh,
				expires: refreshed.expires
			});
			access = refreshed.access;
		} catch {}
		const body = JSON.stringify({ project: active.projectId || "aicode-consumers" });
		let data = null;
		for (const endpoint of CCA_ENDPOINTS) try {
			const resp = await this.fetchImpl(`${endpoint}${FETCH_AVAILABLE_MODELS_PATH}`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${access}`,
					"Content-Type": "application/json",
					"User-Agent": antigravityUserAgent()
				},
				body,
				signal: AbortSignal.timeout(5e3)
			});
			if (resp.ok) {
				data = await resp.json();
				break;
			}
		} catch {}
		if (!data || typeof data !== "object") return null;
		const rawModels = typeof data.models === "object" && data.models !== null ? data.models : {};
		const list = [];
		list.push({
			id: "gemini-3.8-flash",
			name: "Gemini 3.8 Flash",
			contextWindow: 1048576,
			maxTokens: 65536,
			supportsImages: true,
			supportsThinking: true
		});
		for (const [id, info] of Object.entries(rawModels)) {
			if (!info || typeof info !== "object") continue;
			const rec = info;
			if (rec.isInternal || id.startsWith("chat_") || id.startsWith("tab_")) continue;
			if (id === "gemini-3.8-flash" || list.some((m) => m.id === id)) continue;
			const contextWindow = Number(rec.maxTokens ?? rec.inputTokenLimit ?? rec.contextWindow) || 1048576;
			const maxTokens = Number(rec.maxOutputTokens ?? rec.outputTokenLimit) || 65536;
			list.push({
				id,
				name: typeof rec.displayName === "string" && rec.displayName.length > 0 ? rec.displayName : id,
				description: typeof rec.description === "string" ? rec.description : void 0,
				contextWindow,
				maxTokens,
				supportsImages: Boolean(rec.supportsImages),
				supportsThinking: Boolean(rec.supportsThinking),
				thinkingBudget: typeof rec.thinkingBudget === "number" ? rec.thinkingBudget : void 0
			});
		}
		return list;
	}
};
//#endregion
//#region src/store.ts
const AUTH_FORMAT_VERSION = 2;
const LEGACY_FORMAT_VERSION = 1;
const BACKUP_SUFFIX = ".v1.bak";
const MAX_ACCOUNTS = 10;
const MIGRATED_ACCOUNT_ID = "acc_default";
const OAUTH_FIELDS = /* @__PURE__ */ new Set([
	"type",
	"access",
	"refresh",
	"expires",
	"projectId",
	"email"
]);
const ACCOUNT_FIELDS = /* @__PURE__ */ new Set([
	...OAUTH_FIELDS,
	"id",
	"addedAt",
	"hasArgon"
]);
const DEFAULT_ADVANCED_SETTINGS = {
	defaultReasoningEffort: "medium",
	modelContextWindow: 1048576,
	switchingStrategy: "failover_429",
	proactiveThreshold: 20,
	enabledModels: [...DEFAULT_ENABLED_MODELS]
};
function isENOENT(error) {
	return error?.code === "ENOENT";
}
async function assertOwnerOnly(filename) {
	let mode;
	try {
		mode = (await stat(filename)).mode;
	} catch (error) {
		if (isENOENT(error)) return;
		throw error;
	}
	if (process.platform === "win32") return;
	if ((mode & 63) !== 0) throw new Error(`dsh-antigravity-oauth: ${filename} is readable beyond its owner (mode ${(mode & 511).toString(8)}); run "chmod 600 ${filename}" before starting again`);
}
function parseAntigravityOAuth(raw, filename) {
	if (!isRecord(raw)) throw new Error(`dsh-antigravity-oauth: ${filename} credential must be an object`);
	if (raw.type !== "oauth") throw new Error(`dsh-antigravity-oauth: ${filename} credential type must be oauth`);
	if (Object.keys(raw).some((key) => !OAUTH_FIELDS.has(key))) throw new Error(`dsh-antigravity-oauth: ${filename} credential contains an unknown field`);
	if (typeof raw.access !== "string" || raw.access.length === 0) throw new Error(`dsh-antigravity-oauth: ${filename} access must be a non-empty string`);
	if (typeof raw.refresh !== "string" || raw.refresh.length === 0) throw new Error(`dsh-antigravity-oauth: ${filename} refresh must be a non-empty string`);
	if (typeof raw.expires !== "number" || !Number.isFinite(raw.expires) || raw.expires <= 0) throw new Error(`dsh-antigravity-oauth: ${filename} expires must be a positive finite number`);
	if (raw.projectId !== void 0 && (typeof raw.projectId !== "string" || raw.projectId.length === 0)) throw new Error(`dsh-antigravity-oauth: ${filename} projectId must be a non-empty string`);
	if (raw.email !== void 0 && typeof raw.email !== "string") throw new Error(`dsh-antigravity-oauth: ${filename} email must be a string`);
	return {
		type: "oauth",
		access: raw.access,
		refresh: raw.refresh,
		expires: raw.expires,
		...typeof raw.projectId === "string" ? { projectId: raw.projectId } : {},
		...typeof raw.email === "string" ? { email: raw.email } : {}
	};
}
function parseAccount(raw, filename) {
	if (!isRecord(raw)) throw new Error(`dsh-antigravity-oauth: ${filename} account must be an object`);
	if (Object.keys(raw).some((key) => !ACCOUNT_FIELDS.has(key))) throw new Error(`dsh-antigravity-oauth: ${filename} account contains an unknown field`);
	const grant = parseAntigravityOAuth({
		type: raw.type,
		access: raw.access,
		refresh: raw.refresh,
		expires: raw.expires,
		projectId: raw.projectId,
		email: raw.email
	}, filename);
	if (typeof raw.id !== "string" || raw.id.length === 0) throw new Error(`dsh-antigravity-oauth: ${filename} account id must be a non-empty string`);
	if (raw.addedAt !== void 0 && typeof raw.addedAt !== "string") throw new Error(`dsh-antigravity-oauth: ${filename} account addedAt must be a string`);
	if (raw.hasArgon !== void 0 && typeof raw.hasArgon !== "boolean") throw new Error(`dsh-antigravity-oauth: ${filename} account hasArgon must be a boolean`);
	return {
		...grant,
		id: raw.id,
		...typeof raw.addedAt === "string" ? { addedAt: raw.addedAt } : {},
		...typeof raw.hasArgon === "boolean" ? { hasArgon: raw.hasArgon } : {}
	};
}
function parseDocument(text, filename) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error(`dsh-antigravity-oauth: ${filename} is not valid JSON`);
	}
	if (!isRecord(value)) throw new Error(`dsh-antigravity-oauth: ${filename} must contain an object`);
	if (value.version === LEGACY_FORMAT_VERSION) {
		if (Object.keys(value).some((key) => key !== "version" && key !== "credential")) throw new Error(`dsh-antigravity-oauth: ${filename} contains an unknown top-level field`);
		const credential = value.credential === void 0 ? void 0 : parseAntigravityOAuth(value.credential, filename);
		return {
			fromV1: true,
			document: {
				version: AUTH_FORMAT_VERSION,
				activeId: credential === void 0 ? void 0 : MIGRATED_ACCOUNT_ID,
				accounts: credential === void 0 ? [] : [{
					...credential,
					id: MIGRATED_ACCOUNT_ID
				}]
			}
		};
	}
	if (value.version !== AUTH_FORMAT_VERSION) throw new Error(`dsh-antigravity-oauth: ${filename} has unsupported auth format version ${String(value.version)}`);
	if (Object.keys(value).some((key) => key !== "version" && key !== "activeId" && key !== "accounts" && key !== "advanced")) throw new Error(`dsh-antigravity-oauth: ${filename} contains an unknown top-level field`);
	if (!Array.isArray(value.accounts)) throw new Error(`dsh-antigravity-oauth: ${filename} accounts must be an array`);
	if (value.accounts.length > MAX_ACCOUNTS) throw new Error(`dsh-antigravity-oauth: ${filename} supports at most ${MAX_ACCOUNTS} accounts`);
	const accounts = value.accounts.map((account) => parseAccount(account, filename));
	const ids = new Set(accounts.map((account) => account.id));
	if (ids.size !== accounts.length) throw new Error(`dsh-antigravity-oauth: ${filename} contains duplicate account ids`);
	let activeId;
	if (value.activeId !== void 0) {
		if (typeof value.activeId !== "string" || value.activeId.length === 0) throw new Error(`dsh-antigravity-oauth: ${filename} activeId must be a non-empty string`);
		if (!ids.has(value.activeId)) throw new Error(`dsh-antigravity-oauth: ${filename} activeId does not reference a stored account`);
		activeId = value.activeId;
	} else if (accounts.length > 0) activeId = accounts[0].id;
	let advanced;
	if (value.advanced !== void 0 && isRecord(value.advanced)) {
		const rawEffort = String(value.advanced.defaultReasoningEffort || "");
		const defaultReasoningEffort = [
			"low",
			"medium",
			"high"
		].includes(rawEffort) ? rawEffort : DEFAULT_ADVANCED_SETTINGS.defaultReasoningEffort;
		const rawWindow = Number(value.advanced.modelContextWindow);
		const modelContextWindow = Number.isFinite(rawWindow) && Math.floor(rawWindow) >= 1 ? Math.floor(rawWindow) : DEFAULT_ADVANCED_SETTINGS.modelContextWindow;
		const rawStrategy = String(value.advanced.switchingStrategy || "");
		const switchingStrategy = [
			"failover_429",
			"proactive_threshold",
			"round_robin",
			"manual"
		].includes(rawStrategy) ? rawStrategy : DEFAULT_ADVANCED_SETTINGS.switchingStrategy;
		const rawThresh = Number(value.advanced.proactiveThreshold);
		const proactiveThreshold = Number.isFinite(rawThresh) && rawThresh >= 0 && rawThresh <= 100 ? rawThresh : DEFAULT_ADVANCED_SETTINGS.proactiveThreshold;
		let enabledModels = [...DEFAULT_ADVANCED_SETTINGS.enabledModels ?? ["gemini-3.8-flash"]];
		if (Array.isArray(value.advanced.enabledModels)) {
			const filtered = value.advanced.enabledModels.filter((id) => isPublicModelId(String(id)));
			if (filtered.length > 0) enabledModels = Array.from(new Set(filtered));
		}
		advanced = {
			defaultReasoningEffort,
			modelContextWindow,
			switchingStrategy,
			proactiveThreshold,
			enabledModels
		};
	}
	return {
		fromV1: false,
		document: {
			version: AUTH_FORMAT_VERSION,
			activeId,
			accounts,
			...advanced ? { advanced } : {}
		}
	};
}
function antigravityAuthPath(dshHome) {
	return resolve(join(resolveDshHome(dshHome), AUTH_FILENAME));
}
var AntigravityCredentialStore = class {
	filename;
	constructor(filename = antigravityAuthPath()) {
		this.filename = resolve(filename);
	}
	async readParsed() {
		await assertOwnerOnly(this.filename);
		try {
			return parseDocument(await readFile(this.filename, "utf8"), this.filename);
		} catch (error) {
			if (isENOENT(error)) return void 0;
			throw error;
		}
	}
	async writeDocument(next, fromV1) {
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		if (fromV1) try {
			await copyFile(this.filename, this.filename + BACKUP_SUFFIX);
			await chmod(this.filename + BACKUP_SUFFIX, 384);
		} catch (error) {
			if (!isENOENT(error)) throw error;
		}
		await writeFileAtomic(this.filename, `${JSON.stringify(next, null, 2)}\n`, {
			mode: 384,
			dirMode: 448
		});
	}
	async list() {
		const parsed = await this.readParsed();
		return parsed === void 0 ? [] : parsed.document.accounts.map((account) => structuredClone(account));
	}
	async active() {
		const parsed = await this.readParsed();
		if (parsed === void 0) return void 0;
		const found = parsed.document.accounts.find((account) => account.id === parsed.document.activeId) ?? parsed.document.accounts[0];
		return found === void 0 ? void 0 : structuredClone(found);
	}
	async get(id) {
		const found = (await this.readParsed())?.document.accounts.find((account) => account.id === id);
		return found === void 0 ? void 0 : structuredClone(found);
	}
	async add(grant) {
		const clean = parseAntigravityOAuth(structuredClone(grant), this.filename);
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		return withFileLock(this.filename, async () => {
			const parsed = await this.readParsed();
			const accounts = parsed === void 0 ? [] : parsed.document.accounts.map((account) => structuredClone(account));
			const existing = accounts.find((account) => clean.email !== void 0 && account.email !== void 0 && account.email === clean.email || account.refresh === clean.refresh);
			let added;
			if (existing !== void 0) {
				const merged = {
					...existing,
					...clean,
					id: existing.id,
					...existing.addedAt === void 0 ? {} : { addedAt: existing.addedAt }
				};
				const index = accounts.indexOf(existing);
				accounts[index] = parseAccount(merged, this.filename);
				added = accounts[index];
			} else {
				if (accounts.length >= MAX_ACCOUNTS) throw new Error(`dsh-antigravity-oauth: at most ${MAX_ACCOUNTS} accounts are supported`);
				added = parseAccount({
					...structuredClone(clean),
					id: `acc_${randomUUID()}`,
					addedAt: (/* @__PURE__ */ new Date()).toISOString()
				}, this.filename);
				accounts.push(added);
			}
			await this.writeDocument({
				version: AUTH_FORMAT_VERSION,
				activeId: added.id,
				accounts,
				...parsed?.document.advanced ? { advanced: parsed.document.advanced } : {}
			}, parsed?.fromV1 === true);
			return structuredClone(added);
		});
	}
	async update(id, patch) {
		return withFileLock(this.filename, async () => {
			const parsed = await this.readParsed();
			if (parsed === void 0) throw new Error("dsh-antigravity-oauth: no accounts are stored");
			let updated;
			const accounts = parsed.document.accounts.map((account) => {
				if (account.id !== id) return account;
				updated = parseAccount({
					...structuredClone(account),
					...structuredClone(patch)
				}, this.filename);
				return updated;
			});
			if (updated === void 0) throw new Error(`dsh-antigravity-oauth: unknown account ${id}`);
			await this.writeDocument({
				version: AUTH_FORMAT_VERSION,
				activeId: parsed.document.activeId,
				accounts,
				...parsed.document.advanced ? { advanced: parsed.document.advanced } : {}
			}, parsed.fromV1);
			return structuredClone(updated);
		});
	}
	async setActive(id) {
		await withFileLock(this.filename, async () => {
			const parsed = await this.readParsed();
			if (parsed === void 0) throw new Error("dsh-antigravity-oauth: no accounts are stored");
			if (!parsed.document.accounts.some((account) => account.id === id)) throw new Error(`dsh-antigravity-oauth: unknown account ${id}`);
			await this.writeDocument({
				...parsed.document,
				activeId: id
			}, parsed.fromV1);
		});
	}
	async remove(id) {
		return withFileLock(this.filename, async () => {
			const parsed = await this.readParsed();
			if (parsed === void 0) throw new Error("dsh-antigravity-oauth: no accounts are stored");
			const account = parsed.document.accounts.find((entry) => entry.id === id);
			if (account === void 0) throw new Error(`dsh-antigravity-oauth: unknown account ${id}`);
			const accounts = parsed.document.accounts.filter((entry) => entry.id !== id);
			const activeId = parsed.document.activeId === id ? accounts[0]?.id : parsed.document.activeId;
			await this.writeDocument({
				version: AUTH_FORMAT_VERSION,
				activeId,
				accounts,
				...parsed.document.advanced ? { advanced: parsed.document.advanced } : {}
			}, parsed.fromV1);
			return structuredClone(account);
		});
	}
	async getAdvanced() {
		const parsed = await this.readParsed();
		return parsed?.document.advanced ? structuredClone(parsed.document.advanced) : { ...DEFAULT_ADVANCED_SETTINGS };
	}
	async setAdvanced(settings) {
		return withFileLock(this.filename, async () => {
			const parsed = await this.readParsed();
			const current = parsed?.document.advanced ?? DEFAULT_ADVANCED_SETTINGS;
			const rawEffort = String(settings.defaultReasoningEffort || current.defaultReasoningEffort);
			const defaultReasoningEffort = [
				"low",
				"medium",
				"high"
			].includes(rawEffort) ? rawEffort : current.defaultReasoningEffort;
			const rawWindow = Number(settings.modelContextWindow ?? current.modelContextWindow);
			const modelContextWindow = Number.isFinite(rawWindow) && Math.floor(rawWindow) >= 1 ? Math.floor(rawWindow) : current.modelContextWindow;
			const rawStrategy = String(settings.switchingStrategy || current.switchingStrategy);
			const switchingStrategy = [
				"failover_429",
				"proactive_threshold",
				"round_robin",
				"manual"
			].includes(rawStrategy) ? rawStrategy : current.switchingStrategy;
			const rawThresh = Number(settings.proactiveThreshold ?? current.proactiveThreshold);
			const proactiveThreshold = Number.isFinite(rawThresh) && rawThresh >= 0 && rawThresh <= 100 ? rawThresh : current.proactiveThreshold;
			let enabledModels = current.enabledModels ?? [...DEFAULT_ADVANCED_SETTINGS.enabledModels ?? ["gemini-3.8-flash"]];
			if (Array.isArray(settings.enabledModels)) {
				const filtered = settings.enabledModels.filter((id) => isPublicModelId(String(id)));
				if (filtered.length > 0) enabledModels = Array.from(new Set(filtered));
			}
			const nextAdv = {
				defaultReasoningEffort,
				modelContextWindow,
				switchingStrategy,
				proactiveThreshold,
				enabledModels
			};
			const nextDoc = parsed === void 0 ? {
				version: AUTH_FORMAT_VERSION,
				accounts: [],
				advanced: nextAdv
			} : {
				...parsed.document,
				advanced: nextAdv
			};
			await this.writeDocument(nextDoc, parsed?.fromV1 === true);
			return structuredClone(nextAdv);
		});
	}
};
//#endregion
//#region src/plugin-config.ts
const Config = z.object({
	streamIdleTimeoutMs: z.number().min(1).default(STREAM_IDLE_TIMEOUT_MS),
	retryPolicy: RetryPolicySchema,
	nativeTools: z.boolean().default(true),
	nativeSearch: z.boolean().default(true),
	disableImageUpload: z.boolean().default(false),
	imageSlidingWindow: z.boolean().default(true),
	maxFreshImages: z.number().min(1).max(5).default(1)
});
//#endregion
//#region src/index.ts
const name = "llm-antigravity-oauth";
const inject = ["llm", "webServer"];
function isDisposedRegistration(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "REGISTRATION_DISPOSED";
}
async function syncAuthenticatedRoute(session, registration, web2apiRegistration) {
	try {
		const bridged = (await session.manager.read()).enabled;
		registration.replace(bridged || await session.hasReadyAccount() ? [HARNESS_ROUTE] : []);
		if (web2apiRegistration) {
			const webSettings = await session.web2api.read();
			web2apiRegistration.replace(webSettings.enabled ? [WEB2API_ROUTE$1] : []);
		}
	} catch (error) {
		if (isDisposedRegistration(error)) return;
		throw error;
	}
}
function apply(ctx, config) {
	console.log("[my-plugins/dsh-antigravity-oauth] loaded");
	const session = new AntigravitySession(new AntigravityCredentialStore());
	const resolveImageAccess = (ref) => {
		const attachments = ctx.get("attachments");
		if (attachments === void 0) return void 0;
		return resolveImageAttachmentAccess(attachments, (hostPath) => ctx.get("fs")?.processPathFromHostPath(hostPath), ref);
	};
	const registration = ctx.llm.registerAdapter([HARNESS_ROUTE], createAntigravityAdapter(session, {
		nativeTools: config.nativeTools !== false,
		nativeSearch: config.nativeSearch !== false,
		streamIdleTimeoutMs: config.streamIdleTimeoutMs,
		resolveAttachments: () => ctx.get("attachments"),
		resolveImageAccess,
		disableImageUpload: config.disableImageUpload === true,
		imageSlidingWindow: config.imageSlidingWindow !== false,
		maxFreshImages: config.maxFreshImages ?? 1
	}));
	const web2apiAdapter = new Web2ApiAdapter(() => session.web2api.read(), () => ctx.get("attachments"), resolveImageAccess);
	const web2apiRegistration = ctx.llm.registerAdapter([WEB2API_ROUTE$1], web2apiAdapter);
	const refreshRoutes = () => syncAuthenticatedRoute(session, registration, web2apiRegistration);
	refreshRoutes();
	ensureAntigravityVersion(envProxyFetch);
	ctx.effect(() => {
		session.apiServer.start().catch((err) => {
			console.warn("[dsh-antigravity-oauth] failed to start API server:", err);
		});
		return () => {
			session.apiServer.stop().catch(() => {});
		};
	}, "dsh-antigravity-oauth: api proxy server");
	ctx.effect(() => {
		const timer = setInterval(() => {
			session.refreshIfNeeded().catch(() => {});
		}, OAUTH_REFRESH_POLL_MS);
		session.refreshIfNeeded().catch(() => {});
		return () => clearInterval(timer);
	}, "dsh-antigravity-oauth: refresh oauth grant");
	ctx.inject(["webServer"], (webCtx) => {
		registerAntigravityAuthRoutes(webCtx, session, { onAuthChanged: refreshRoutes });
	});
	if (config.nativeTools !== false) ctx.inject(["systemPrompt"], (promptCtx) => {
		promptCtx.on("system-prompt/assemble", async (_assembly, context, next) => {
			const assembled = await next();
			if (context.agent?.options?.provider !== "agy-google-antigravity") return assembled;
			return (await session.manager.read()).enabled ? assembled : maskDshWebAssembly(assembled);
		});
	});
}
//#endregion
export { AUTH_COMPLETE_PATH, AUTH_FILENAME, AUTH_LOGIN_PATH, AUTH_LOGOUT_PATH, AUTH_STATUS_PATH, AntigravityCredentialStore, AntigravitySession, BOOT_MARKER, CcaClient, Config, HARNESS_ROUTE, LOAD_CODE_ASSIST_BODY, SCOPES, SEARCH_ANSWER_GUIDANCE, SEARCH_CONTINUE_GUIDANCE, SEARCH_FOLLOW_UP_LIMIT, THOUGHT_ONLY_CONTINUE, WEB2API_ROUTE, Web2ApiAdapter, antigravityAuthPath, appendContinueMemo, appendSearchDossier, appendSearchMemo, appendSearchTurns, apply, authorizationUrl, buildCcaBody, createAntigravityAdapter, createCcaSession, inject, name, registerAntigravityAuthRoutes, streamGenerateContentUrl, syncAuthenticatedRoute, withoutSearchWeb };
