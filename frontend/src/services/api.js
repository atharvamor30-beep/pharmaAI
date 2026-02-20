import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''
const api = axios.create({ baseURL: `${API_BASE}/api` })

export { API_BASE }

export async function analyzeVCF(formData) {
  const resp = await api.post('/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return resp.data
}

export default api
