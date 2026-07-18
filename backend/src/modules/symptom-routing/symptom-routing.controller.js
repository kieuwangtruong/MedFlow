const symptomRoutingService = require('./symptom-routing.service');

const routeSymptoms = async (req, res, next) => {
  try {
    const result = await symptomRoutingService.routeSymptoms(req.body);
    res.status(result.statusCode).json(result.data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  routeSymptoms
};
