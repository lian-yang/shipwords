# 无水印权益展示验收

站点：https://www.freeaivideo.app/

正式版本：`d48247f2-2670-49cc-a498-3324db95ae37`，部署记录确认 100% 生效。

- 生成按钮前、Starter、Creator 和账户注册试用券卡片统一显示 **No watermark added / 无本站水印**，沿用已有文本样式。
- 无水印 FAQ 明确覆盖每日试用、注册券和积分视频，说明无单独导出费用；可见内容与结构化数据共用同一消息。
- 只调整 7 个展示/文案文件；规格、积分、价格、额度、业务服务端与数据库结构源码保持原状，已与上一发布源哈希比对。
- 类型、生产构建、站点边界检查及 7 文件 Biome 通过；中英消息键和占位参数匹配。纯展示变更未新增或重复运行业务测试。
- 本地中英生成入口、两套餐与真实本地会话的注册券卡片通过；390px 首页、账户弹窗无横向溢出，截图已查看。
- 正常浏览器的生产验收通过；title、H1、canonical、description 与发布前完全一致，8 条 FAQ 与结构化数据一致。未触发生产写请求、视频生成、付款或邮件。
- CLI 的两个发布前 curl 探针遇到本机 LibreSSL 连接失败；浏览器发布前后均正常，未修改防护配置。

使用 main 基线 `856646a516b8b2cbb2fa8216ad6a704c1c4e7881` 的隔离发布目录；发布前确认上一版本 `4e963caf-91c6-4fd1-b3c8-36eecaa8dc12` 仍为 100%，以 keep-vars/strict 发布。未修改共享 packages、秘密值或资源，未提交或推送 Git。源码与构建哈希在 `release-source.json`。

代码关系图已更新；本轮浏览器和隔离开发服务已关闭。原开发服务保留。

证据：`browser-results.json`、`production-before.json`、`production-results.json`、`deployment.json`、`site-check.log`、`dry-run.log`、`deploy.log`及截图。
