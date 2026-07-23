const { requestAi } = require('../ai-gateway/ai-client');

function aiPriority(priority) {
  return ['EMERGENCY', 'URGENT'].includes(priority) ? priority : 'NORMAL';
}

function taskEvent(eventType, task, options = {}) {
  return {
    event_id: options.eventId || `backend:${eventType}:${task.id}`,
    event_time: (options.eventTime || new Date()).toISOString(),
    journey_id: task.journeyId,
    task_id: task.id,
    patient_token: task.patientToken,
    queue_id: task.roomId || task.queueId,
    event_type: eventType,
    task_type: task.taskType,
    clinical_priority: aiPriority(task.clinicalPriority),
    actor_id: options.actorId || 'backend-orchestrator',
    actor_type: options.actorType || 'SERVICE',
    correlation_id: options.correlationId || task.journeyId,
    metadata: options.metadata || {},
  };
}

async function emitAiEvents(events) {
  const results = [];
  for (const event of events) {
    try {
      results.push(await requestAi('/api/v1/events', {
        method: 'POST',
        body: event,
        timeoutMs: 3000,
      }));
    } catch (error) {
      results.push({
        accepted: false,
        event_id: event.event_id,
        error: error.code || 'AI_EVENT_SYNC_FAILED',
      });
      break;
    }
  }
  return {
    synced: results.length === events.length
      && results.every((result) => result.accepted || result.duplicate),
    events: results,
  };
}

module.exports = { emitAiEvents, taskEvent };
