# ComfyUI Client

ComfyUI的TypeScript客户端实现，包含Node.js SDK和React演示界面。

## 功能特性

- 完整的ComfyUI WebSocket客户端实现
- Express API服务器
- React演示界面
- TypeScript类型支持
- 工作流管理
- 图片标签生成

## 目录结构

```
comfyui-client/
├── src/                # SDK源代码
│   ├── comfy_client.ts # ComfyUI客户端实现
│   ├── server.ts      # Express API服务器
│   └── types/         # TypeScript类型定义
├── client/            # React演示界面
├── workflows/         # 工作流JSON文件
└── dist/             # 编译输出目录
```

## 安装

1. 克隆仓库：
```bash
git clone [repository-url]
cd comfyui-client
```

2. 安装依赖：
```bash
# 安装服务器依赖
npm install

# 安装客户端依赖
cd client
npm install
```

## 使用方法

### 启动服务器

```bash
# 编译TypeScript代码
npm run build

# 启动API服务器（支持热重载）
npm run server
```

### 启动客户端

```bash
cd client
npm run dev
```

## API文档

### Tagger API

用于生成图片标签的API接口。

**端点:** `POST /api/tagger`

**请求体:**
```json
{
  "imagePath": string  // 图片文件的本地路径（必须是ComfyUI服务器可访问的路径）
}
```

**响应:**
```json
{
  "success": boolean,
  "data"?: {
    "images": any[],    // 生成的图片数组（如果有）
    "outputs": {        // 工作流输出
      "tags": string[]
    }
  },
  "error"?: string     // 错误信息（如果失败）
}
```

**示例:**
```bash
curl -X POST http://localhost:3000/api/tagger \
  -H "Content-Type: application/json" \
  -d '{"imagePath": "/path/to/image.jpg"}'
```

**错误码:**
- 400: 缺少必要参数
- 500: 服务器内部错误

## 配置说明

### ComfyUI服务器配置

默认配置：
- 地址：`http://localhost:8188`
- WebSocket端点：`/ws`

如需修改ComfyUI服务器地址，请在实例化`ComfyClient`时传入新地址：

```typescript
const client = new ComfyClient('http://your-server:8188');
```

### Express服务器配置

默认配置：
- 端口：3000
- CORS：已启用

## 开发指南

1. 修改SDK代码：
   - 源代码在`src`目录
   - 使用`npm run dev`实时编译

2. 修改React客户端：
   - 代码在`client`目录
   - 使用`npm run dev`启动开发服务器

3. 添加新工作流：
   - 将工作流JSON文件放在`workflows`目录
   - 在`server.ts`中引用新工作流

## 注意事项

1. 确保ComfyUI服务器已启动并可访问
2. 图片路径必须是ComfyUI服务器可以访问的本地路径
3. 工作流文件必须符合ComfyUI的格式要求

## 许可证

ISC 