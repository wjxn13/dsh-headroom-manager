# dsh-headroom-manager

> **⚠️ 已合并（DEPRECATED）**：本插件已并入
> [dsh-headroom-suite](https://github.com/wjxn13/dsh-headroom-suite)（二合一套件）。
> 建议直接安装套件。


DeepSeek Harness 插件：Headroom 压缩代理的**进程管理面板**。

官方 `headroom-switch` 插件只切换线路（`llm-deepseek.baseURL`），从不启动/停止
headroom 进程本身。本插件补上这块：

- 设置页新增「代理管理」面板（紧跟官方「线路切换」之后）
- 一键 **启动 / 停止** headroom.exe（detached 启动，不随 dsh 重启而退出）
- 实时健康状态（/livez 探测，版本 + PID）
- 累计节省统计（请求数、缓存节省金额、压缩节省金额与 token 数）

## 数据平面（host 半 HTTP 路由）

| 路由 | 方法 | 说明 |
|---|---|---|
| `/headroom-mgr/status` | GET | 探测 /livez + 读 /stats-history 节省统计 |
| `/headroom-mgr/start`  | POST | spawn headroom.exe（同源校验） |
| `/headroom-mgr/stop`   | POST | 按 8787 端口找 PID 并 taskkill（同源校验） |

启动参数与环境变量完全对齐 `~/.headroom/start-headroom.vbs`
（HEADROOM_DETECT_BACKEND=python、HEADROOM_TOOL_SEARCH=off），行为与桌面快捷方式一致。

## 安装

```bash
dsh plugin --profile web add github:wjxn13/dsh-headroom-manager#main
```

或手动：克隆到 profile 的 node_modules 后，把 cordis.patch.yml 的 insert 行合入 profile 配置。
