import { useState } from "react"

export default function TaggingDemo() {
    const [imagePath, setImagePath] = useState('')
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // 提交表单的异步函数
    const handleSubmit = async () => {
        // 如果没有输入图片路径，则设置错误信息并返回
        if (!imagePath) {
            setError('请输入图片路径')
            return
        }

        // 设置加载状态为true
        setLoading(true)
        // 清空错误信息
        setError('')
        try {
            // 发送POST请求，将图片路径作为请求体发送到服务器
            const response = await fetch('http://localhost:3000/api/tagger', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ imagePath }),
            })

            // 将响应转换为JSON格式
            const data = await response.json()
            // 如果请求失败，则抛出错误
            if (!data.success) {
                throw new Error(data.error)
            }

            // 设置结果
            setResult(data.data)
        } catch (err) {
            // 设置错误信息
            setError(err instanceof Error ? err.message : '请求失败')
        } finally {
            // 设置加载状态为false
            setLoading(false)
        }
    }

    return (<div className="container">
        <h1>ComfyUI Tagger Demo</h1>

        <div className="input-group">
            <input
                type="text"
                value={imagePath}
                onChange={(e) => setImagePath(e.target.value)}
                placeholder="输入图片路径"
                className="input"
            />
            <button
                onClick={handleSubmit}
                disabled={loading}
                className="button"
            >
                {loading ? '处理中...' : '生成标签'}
            </button>
        </div>

        {error && <div className="error">{error}</div>}

        {result && (
            <div className="result">
                <h2>处理结果：</h2>
                <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
        )}
    </div>);
}

