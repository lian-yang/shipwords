# 中文完善、政策更新与正式发布

2026-11-01，已发布：https://www.freeaivideo.app/

Cloudflare 版本：`a0f7e29f-0c6f-4232-9f66-71a99b217e31`，100% 生效。

## 交付内容

- 按用户确认，正式站保持英文，本地预览可切换完整中文；手机也保留语言切换入口。
- 中英文每套 325 条消息，覆盖首页、FAQ、导航、套餐、登录/账户、错误反馈、两个介绍页和四类政策页；消息键和占位参数一致，无模板 TODO。
- 隐私政策补全数据用途、服务商、文件链接访问、存储、Cookie、隐私请求与 GA4 披露。服务条款补全账户、内容权限、积分、取消、AI 结果限制和政策链接；退款及版权通知流程同步完善。
- 联系邮箱统一为用户确认的 `support@freeaivideo.app`。没有更改邮箱路由或发送测试邮件。
- GA4 `G-YJ3Q2BRW3C` 使用既有统计脚本入口接入，正式页面唯一加载器、初始化及 `https://analytics.google.com/g/collect` 请求均已观察到。本地预览继续跳过统计。
- 原案例视频的英文原始提示词保留为来源内容；产品名称和服务商名称保留原名。
- 类型检查与预览统一使用 locale-modules，避免检查过程删除开发预览正在使用的中文模块；生产英文仍使用独立构建目录。

## 验证

- 本地 7 页 × 中英两种语言 × 3 轮，共 42 次 SSR 验证通过。
- 浏览器连续 3 轮通过：政策页跳转与刷新、中文 FAQ 与 JSON-LD 对齐、上传失败中文提示、套餐及登录弹窗、切换语言后保留提示词和页面路径。
- 桌面和手机无横向溢出；已查看中文条款、隐私政策、首页及登录截图。
- 发布包站点 check（类型、构建、站点检查）通过；core 93 项、jobs 164 项测试通过；工具检查 13 项通过。
- 当前任务涉及的源文件定向 Biome 通过。全仓 lint 仍会报告旧设计留档与 graphify 生成物的格式/静态检查问题；没有为了通过全仓检查而批量修改这些文件。
- 正式浏览器确认首页、privacy、terms、refunds、dmca、两个介绍页、robots.txt、sitemap.xml、llms.txt 均 HTTP 200。正式环境英文且没有语言切换按钮，GA4 初始化成功，主配图加载成功。
- 没有提交真实生成任务、付款或发送验证码；未把统计请求等同于真实访客、收入或转化。

## 发布范围与可追溯性

从当前 `main` 基线 `856646a516b8b2cbb2fa8216ad6a704c1c4e7881` 制作隔离发布包，仅包含本站和维持既有 Turnstile/Resend 功能所需的依赖。排除了另一个测试站及其锁文件条目；验证码未配置时继续拒绝游客请求，没有带入允许直接通过的改动。必要的验证码控件清理修复及重复提交测试也在隔离包内完成。

共享 packages 的原工作区没有被覆盖；必要依赖补丁保存在 `release-required-dependencies.patch`，源文件和构建物摘要保存在 `release-source.json`。这两个文件记录实际发布包，基线 SHA 不是本次新增的 Git 提交。未进行 Git 提交或 push，未执行远程迁移、变更秘密值或创建新的 Cloudflare 资源。

构建物 SHA-256：`b2314894194ea09451e929d7c4867d63b560eda463491992ba2ff5f4f90dca95`。

## 证据

`browser-results.json`、`ssr-results.json`、`message-check.json`、`production-http-results.json`、`production-browser-results.json`、`production-desktop.png` 及 `zh-*.png`。GA4 只验证到加载、初始化与发起采集请求，没有登录 Analytics 后台核对报表。

政策参考：[美国版权局第512条](https://www.copyright.gov/title17/92chap5.html#512)、[Google Analytics 隐私](https://support.google.com/analytics/answer/6004245)、[Google Analytics 数据处理](https://support.google.com/analytics/answer/11397207)、[Cloudflare](https://www.cloudflare.com/privacypolicy/)、[Stripe](https://stripe.com/privacy)、[Google](https://policies.google.com/privacy)、[Resend](https://resend.com/legal/privacy-policy)。
