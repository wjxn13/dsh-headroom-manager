window.__ModuleLoader__.load({
	id: "dsh-headroom-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let dsh_client_web_react = require("@deepseek-ai/dsh-client-web-react");

		const STATUS_URL = "/headroom-mgr/status";
		const START_URL = "/headroom-mgr/start";
		const STOP_URL = "/headroom-mgr/stop";

		function fetchJson(url, opts) {
			return fetch(url, Object.assign({ cache: "no-store" }, opts)).then((r) => r.json());
		}

		function postJson(url) {
			return fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
			}).then((r) => r.json().then((b) => ({ status: r.status, body: b })));
		}

		const fmtUsd = (v) => (typeof v === "number" ? "$" + v.toFixed(2) : "—");
		const fmtTok = (v) => (typeof v === "number" ? v.toLocaleString() : "—");

		/**
		 * Proxy management section. Registered on the settings.section slot right
		 * after the official route-switch page (order 20) so the two read as one
		 * Headroom feature family.
		 */
		function ManagerSection(props) {
			const { t } = props;
			const [st, setSt] = react.useState({ loading: true });
			const [busy, setBusy] = react.useState("");
			const [msg, setMsg] = react.useState(null);

			const refresh = react.useCallback(() => {
				fetchJson(STATUS_URL).then((s) => setSt(Object.assign({ loading: false }, s)));
			}, []);
			react.useEffect(() => {
				refresh();
				const timer = setInterval(refresh, 15000);
				return () => clearInterval(timer);
			}, [refresh]);

			const doStart = async () => {
				setBusy("start"); setMsg(null);
				try {
					const r = await postJson(START_URL);
					if (r.body.ok && r.body.healthyAfterStart) setMsg(t("startOk"));
					else if (r.body.ok) setMsg(t("startedSlow"));
					else setMsg(t("startFail") + ": " + JSON.stringify(r.body));
					refresh();
				} catch (e) { setMsg(t("startFail") + ": " + e); }
				setBusy("");
			};
			const doStop = async () => {
				setBusy("stop"); setMsg(null);
				try {
					const r = await postJson(STOP_URL);
					setMsg(r.body.ok ? t("stopOk") : t("stopFail") + ": " + JSON.stringify(r.body));
					refresh();
				} catch (e) { setMsg(t("stopFail") + ": " + e); }
				setBusy("");
			};

			const running = st.running === true;
			const sv = st.savings || {};
			return react_jsx_runtime.jsxs("section", {
				style: { display: "flex", flexDirection: "column", gap: "16px" },
				"aria-label": t("nav"),
				children: [
					react_jsx_runtime.jsxs("div", {
						style: { border: "1px solid var(--dsw-color-border-strong,#d0d7de)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" },
						children: [
							react_jsx_runtime.jsxs("div", {
								style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
								children: [
									react_jsx_runtime.jsx("span", { style: { color: "var(--dsw-color-text-secondary,#57606a)", fontSize: "13px" }, children: t("procStatus") }),
									st.loading
										? react_jsx_runtime.jsx("span", { style: { fontSize: "13px", color: "#57606a" }, children: t("probing") })
										: running
											? react_jsx_runtime.jsx("span", { style: { borderRadius: "999px", padding: "2px 10px", fontSize: "12px", fontWeight: 600, background: "var(--dsw-color-success-bg,#dafbe1)", color: "var(--dsw-color-success-fg,#1a7f37)" }, children: (t("running") + " v" + (st.version || "?") + (st.pid ? " · PID " + st.pid : "")) })
											: react_jsx_runtime.jsx("span", { style: { borderRadius: "999px", padding: "2px 10px", fontSize: "12px", fontWeight: 600, background: "var(--dsw-color-danger-bg,#ffebe9)", color: "var(--dsw-color-danger-fg,#cf222e)" }, children: t("stopped") }),
								],
							}),
							react_jsx_runtime.jsxs("div", {
								style: { display: "flex", gap: "8px", marginTop: "4px" },
								children: [
									react_jsx_runtime.jsx("button", {
										type: "button",
										className: "dsw-button dsw-button--primary",
										disabled: busy !== "" || running,
										onClick: doStart,
										children: busy === "start" ? t("starting") : t("btnStart"),
									}),
									react_jsx_runtime.jsx("button", {
										type: "button",
										className: "dsw-button",
										disabled: busy !== "" || !running,
										onClick: doStop,
										children: busy === "stop" ? t("stopping") : t("btnStop"),
									}),
								],
							}),
							msg ? react_jsx_runtime.jsx("div", { style: { fontSize: "12px", color: "var(--dsw-color-text-secondary,#57606a)" }, children: msg }) : null,
						],
					}),
					running ? react_jsx_runtime.jsxs("div", {
						style: { border: "1px solid var(--dsw-color-border-strong,#d0d7de)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" },
						children: [
							react_jsx_runtime.jsx("div", { style: { fontWeight: 600, fontSize: "13px", marginBottom: "4px" }, children: t("savingsTitle") }),
							react_jsx_runtime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "13px" }, children: [
								react_jsx_runtime.jsx("span", { style: { color: "var(--dsw-color-text-secondary,#57606a)" }, children: t("totalRequests") }),
								react_jsx_runtime.jsx("b", { children: fmtTok(sv.requests) }),
							] }),
							react_jsx_runtime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "13px" }, children: [
								react_jsx_runtime.jsx("span", { style: { color: "var(--dsw-color-text-secondary,#57606a)" }, children: t("cacheSaved") }),
								react_jsx_runtime.jsx("b", { children: fmtUsd(sv.cache_savings_usd) }),
							] }),
							react_jsx_runtime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "13px" }, children: [
								react_jsx_runtime.jsx("span", { style: { color: "var(--dsw-color-text-secondary,#57606a)" }, children: t("compressSaved") }),
								react_jsx_runtime.jsx("b", { children: fmtUsd(sv.compression_savings_usd) }),
							] }),
							react_jsx_runtime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--dsw-color-text-secondary,#57606a)" }, children: [
								react_jsx_runtime.jsx("span", { children: t("compressTokens") }),
								react_jsx_runtime.jsx("span", { children: fmtTok(sv.tokens_saved) }),
							] }),
						],
					}) : null,
				],
			});
		}

		const zh = {
			nav: "代理管理",
			procStatus: "Headroom 进程",
			probing: "探测中…",
			running: "运行中",
			stopped: "未运行",
			btnStart: "启动代理进程",
			btnStop: "停止代理进程",
			starting: "启动中…",
			stopping: "停止中…",
			startOk: "✅ 代理已启动并通过健康检查",
			startedSlow: "⚠️ 已发出启动命令，但健康检查尚未通过（可能仍在初始化，稍后刷新查看）",
			startFail: "❌ 启动失败",
			stopOk: "✅ 代理已停止",
			stopFail: "❌ 停止失败",
			savingsTitle: "累计节省统计（lifetime）",
			totalRequests: "处理请求数",
			cacheSaved: "缓存命中节省",
			compressSaved: "上下文压缩节省",
			compressTokens: "压缩节省 token 数",
		};

		const inject = ["slots", "locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("headroom-manager", { zh }), "headroom-manager: copy");
			const t = ctx.locale.bind("headroom-manager");
			ctx.slots.inject("settings.section", () =>
				ctx.slots.register(
					{ name: "settings.section", id: "headroom-manager", order: 21, label: () => zh.nav, inject: () => ({ t }) },
					ManagerSection
				)
			);
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
