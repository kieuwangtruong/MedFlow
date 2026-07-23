const { requestAi } = require('../ai-gateway/ai-client');

async function routeSymptoms(payload) {
  const data = await requestAi('/api/v1/symptom-routing', { method: 'POST', body: payload });
  return { statusCode: 200, data };
}

module.exports = {
  routeSymptoms
};
