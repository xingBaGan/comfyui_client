import { useState } from 'react'
import './App.css'

function App() {
  const [imagePath, setImagePath] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!imagePath) {
      setError('请输入图片路径')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:3000/api/tagger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imagePath }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error)
      }

      setResult(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
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
    </div>
  )
}

export default App
