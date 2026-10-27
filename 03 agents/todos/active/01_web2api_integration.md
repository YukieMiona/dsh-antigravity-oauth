# 任务清单：Gemini Web2API 模块化集成与开关机制

- 目标：将 `zexadev/gemini-web2api-go` 的 Web 逆向能力作为可独立开关的扩展特性接入 `dsh-antigravity-oauth`。
- 架构约束：
  1. 默认关闭（Zero Impact）：关闭时完全维持原有的 CCA 官方 OAuth 逻辑，不引入任何行为变更；
  2. 独立命名空间：Web2API 注册的模型带有专属前缀（如 `agy-web/`），与主线 `gemini-3.8-flash` 互不干扰；
  3. 灵活接入：支持自定义端点（本地 `127.0.0.1:8080` 或远程反代）、自定义 API Key、启用/禁用 Imagen 3 生图；
  4. 完整单测：覆盖协议转换、流式 SSE 解析、思考块提炼、连通性探测以及开关状态控制；
  5. 鸣谢引用：在 README.md / README.zh.md 开头与扩展说明章节明确致谢 `zexadev/gemini-web2api-go`。

## 待办卡片进度

- [x] Task 1: 架构与配置定义（src/types.ts, src/ids.ts, src/plugin-config.ts, src/web2api/types.ts）定义 Web2Api 配置 Schema
- [x] Task 2: Web2Api 核心客户端与适配器实现（src/web2api/client.ts, src/web2api/adapter.ts, src/web2api/store.ts）
- [x] Task 3: 插件生命周期与模型动态注册接入（src/index.ts, src/auth-routes.ts, src/session.ts）
- [x] Task 4: 设置前端 UI 面板实现（src/client/Settings.tsx, src/client/locales.ts）
- [x] Task 5: 编写单元测试套件（tests/web2api.spec.ts, tests/route-sync.spec.ts）并执行自动化测试（101 passed）
- [x] Task 6: 更新 README.md 与 README.zh.md 并添加项目致谢 (Credit)
- [x] Task 7: 编译构建与双 profile 部署一致性验证
