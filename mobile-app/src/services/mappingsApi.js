import { API_CONFIG } from '../config/arm';

export async function saveMappingToBackend({ gesture, movement, sequence }) {
  const payload = { gesture, movement, sequence };
  console.log('HTTP => POST /mappings', JSON.stringify(payload));

  const response = await fetch(`${API_CONFIG.baseUrl}/mappings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST /mappings failed (${response.status}): ${text}`);
  }

  return response.json();
}
