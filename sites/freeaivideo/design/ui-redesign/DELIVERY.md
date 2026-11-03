# Free AI Video UI 交付与验收

采用 **Daylight studio**：暖白、墨色、柠檬绿操作区，生成配图承担画面情绪。三套首屏已对比，自行选定这一版，因为生成器可直接使用，且配图不会挤走主要操作。

本地预览：http://localhost:5051/

## 已完成

- 重构首页、导航、表单、真实案例、步骤、限制、定价、FAQ，以及共用的登录/定价/账户弹窗和阅读页样式。
- 保留原来的单一 H1、title/description 生成逻辑、WebApplication 数据、OG 引用、区块顺序、主要锚点、搜索落地页与政策链接。
- 新增 7 条 FAQ，以同一份数据输出可见问答与 FAQPage JSON-LD；更正 llms.txt 的图片产品与订阅残留。
- 新增灵感与案例提示词填入入口；修复初始化保存顺序，避免恢复前写入空草稿。
- 真实案例视频改为跟随 site.url。旧 workers.dev 地址已返回 404；当前 www 地址的三个原视频都已实际播放成功。
- 没有修改生成请求、费用、额度、支付或认证后台逻辑。没有生产发布、真实生成、付款、发邮件或账户登录。

## 素材

使用内置 image_gen 生成电影感星球沙丘与宇航员图，作为 **Prompt inspiration**；它不是站点生成的视频成片。原有三个真实视频及准确提示词继续展示。

上线使用的文件：

- `public/images/planet-walk.webp`：1440×960，约 103 KiB。
- `public/images/planet-walk-small.webp`：720×480，约 27 KiB。
- 完整生成提示词见 `IMAGE-PROVENANCE.md`。没有调用额外付费图片服务。

## 动效与减法

工作台短促进入、按钮按压与焦点反馈、弹窗进入、任务进行中指示；减少动态效果时移除动画。真实视频改成用户主动播放，有原生控制栏。本页属于生成工具，保留原生滚动，没有设置展示型滚动叙事。

删除了重复的首屏承诺条、模型下拉中的 free-to-try 后缀、FAQ 空泛导语与 No surprises 文案。缩短首页导语；具体免费额度、额外消费和退款规则仍保留。

## 评审

一次独立视觉评审 **8/10**，并完成独立代码/SEO 审查，无正确性问题。视觉建议已处理：手机模型名完整显示、正文及 FAQ 行长缩短、重复文字删减、提示词填入后聚焦输入框。最初视频播放失败已定位为旧域名失效，更新地址后主验收浏览器确认三个视频均能播放，readyState=4、无媒体错误。本轮未再次打分。

## 验证结果

- `pnpm check` 通过：类型检查、受影响站点构建、站点规则检查。
- 6 个相关源文件及文案定向 Biome 检查通过。
- `verify-ui.mjs` 连续 3 轮通过，每轮 11 组断言：提示词、五种比例、刷新读回、无效图片失败反馈且输入保留、价格弹窗、登录弹窗、FAQ 展开/收起、焦点、H1/canonical、结构化数据和溢出。
- 手机 390×844、桌面 1440×900、等效 200% 阅读重排检查通过；减少动态效果时动画关闭、案例不自动播放。
- SSR 中 7 条 FAQ 与 JSON-LD 问答完全一致。现有 8 个落地/政策/抓取入口均 HTTP 200。
- `graphify update .` 已执行，AST 图更新完成。

证据：

- `delivery/`：最终首屏、2 倍像素图、进入及提示词操作录屏、检查报告。
- `delivery-full/`：最终桌面与手机整页截图；没有横向溢出、图片加载失败或可读性提示。
- `pricing-dialog.png`、`sign-in-dialog.png`、`mobile-pricing.png`、`desktop-200-percent.png`。
- `interaction-results.json`、`seo-results.json`、`media-results.json`。
- `explore/style-explorer.html`、`explore/shots/sheet.png`：三方向留档。

现有环境提示：Node 22 低于仓库声明的 Node 24、构建 CSS sourcemap 提示和 Biome 配置弃用提示均未阻断检查。部分隔离截图会记录 Google One Tap 的未登录/FedCM 403；登录弹窗打开、关闭已验证，Google 实际认证与支付不在本轮 UI 验收范围。截图工具把工具页按展示落地页提示滚动叙事，该项不适用于本页。

工作区已有的 packages、锁文件和 site.config 并行变更未覆盖。canonical 随当前站点配置（www 域名）生成，本次没有改站点地址配置。
