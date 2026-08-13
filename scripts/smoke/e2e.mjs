const backendInput = process.env.SMOKE_BACKEND_URL?.trim()
const cccd = process.env.SMOKE_PATIENT_CCCD?.trim()

if (!backendInput || !cccd) {
  console.error('SMOKE_BACKEND_URL and SMOKE_PATIENT_CCCD are required')
  process.exit(2)
}
if (!/^\d{9,12}$/.test(cccd)) {
  console.error('SMOKE_PATIENT_CCCD must contain 9 to 12 digits')
  process.exit(2)
}

const origin = /^https?:\/\//i.test(backendInput) ? backendInput : `https://${backendInput}`
const baseUrl = new URL('/api/v1/', origin).toString()

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(new URL(path.replace(/^\//, ''), baseUrl), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${method} ${path} failed with HTTP ${response.status}`)
  return data
}

function passed(step) {
  console.log(`PASS ${step}`)
}

try {
  const auth = await request('/auth/login', {
    method: 'POST',
    body: { cccd, fullName: 'Bệnh nhân Smoke Test' },
  })
  if (!auth.access_token) throw new Error('Patient login returned no access token')
  passed('patient login')

  const checkin = await request('/checkins', {
    method: 'POST',
    token: auth.access_token,
    body: { examinationType: 'GENERAL', patientType: 'INSURANCE' },
  })
  if (!checkin.visitId) throw new Error('Check-in returned no visit ID')
  passed(checkin.existing ? 'active check-in restored' : 'patient check-in created')

  if (checkin.requiresSymptoms !== false) {
    const symptoms = {
      description: 'Synthetic smoke test: ho nhẹ và khó chịu đường hô hấp',
      onset: 'Synthetic smoke test',
      painLevel: 2,
      commonSymptoms: ['ho nhẹ'],
      dangerSigns: [],
    }
    await request(`/visits/${checkin.visitId}/symptoms`, {
      method: 'POST', token: auth.access_token, body: symptoms,
    })
    passed('symptoms submitted')

    const recommendation = await request('/symptom-routing', {
      method: 'POST',
      body: {
        symptom_text: symptoms.description,
        age: 35,
        gender: 'UNKNOWN',
        pregnancy_status: 'NA',
        top_k: 3,
      },
    })
    const top = recommendation.recommendations?.[0]
    if (!top?.clinic_room) throw new Error('AI returned no room recommendation')
    passed('AI suggestion returned')

    await request(`/visits/${checkin.visitId}/routing`, {
      method: 'POST',
      token: auth.access_token,
      body: {
        department: top.department_name,
        room: top.clinic_room,
        source: 'SMOKE_TEST',
      },
    })
    passed('room confirmed and queue created')
  }

  const pathway = await request(`/visits/${checkin.visitId}/pathway`, {
    token: auth.access_token,
  })
  if (!pathway.visitId || !Array.isArray(pathway.steps)) {
    throw new Error('Patient pathway response is incomplete')
  }
  passed('patient journey returned')
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : 'unknown smoke-test error'}`)
  process.exit(1)
}
