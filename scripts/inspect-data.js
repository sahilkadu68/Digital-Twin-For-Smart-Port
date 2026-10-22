// Read-only: mongosh <existing connection URI> --quiet --file scripts/inspect-data.js
const c = db.containers
const group = field => c.aggregate([{ $group: { _id: '$' + field, count: { $sum: 1 } } }]).toArray()
print(JSON.stringify({
  inspectedAt: new Date().toISOString(),
  collections: db.getCollectionNames().map(name => ({ name, count: db.getCollection(name).countDocuments({}) })),
  byTerminal: group('terminal'), statuses: group('status'), types: group('type'), provenance: group('simulated'),
  dates: c.aggregate([{ $group: { _id: { $type: '$arrivalDate' }, min: { $min: '$arrivalDate' }, max: { $max: '$arrivalDate' }, count: { $sum: 1 } } }]).toArray(),
  fields: c.aggregate([{ $project: { fields: { $objectToArray: '$$ROOT' } } }, { $unwind: '$fields' }, { $group: { _id: { field: '$fields.k', type: { $type: '$fields.v' } }, count: { $sum: 1 } } }]).toArray(),
  duplicateNumbers: c.aggregate([{ $group: { _id: '$containerNumber', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: 'groups' }]).toArray(),
  collidingSlots: c.aggregate([{ $group: { _id: { t: '$terminal', b: '$block', r: '$row', c: '$column', l: '$level' }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: 'groups' }]).toArray(),
  terminals: db.terminals.find({}, { _id: 0, code: 1, yardCapacity: 1 }).toArray(),
  equipmentBlocks: db.equipment.distinct('block'),
  otherSchemas: ['terminals', 'equipment', 'vehicles', 'environment_readings'].map(name => ({ name,
    fields: db.getCollection(name).aggregate([{ $project: { f: { $objectToArray: '$$ROOT' } } }, { $unwind: '$f' }, { $group: { _id: { field: '$f.k', type: { $type: '$f.v' } }, count: { $sum: 1 } } }]).toArray(),
    simulated: db.getCollection(name).aggregate([{ $group: { _id: '$simulated', count: { $sum: 1 } } }]).toArray(),
  })),
  orphanTerminals: c.aggregate([{ $lookup: { from: 'terminals', localField: 'terminal', foreignField: 'code', as: 'terminalRecord' } }, { $match: { terminalRecord: { $size: 0 } } }, { $count: 'records' }]).toArray(),
  invalidDates: c.countDocuments({ arrivalDate: { $not: /^\d{4}-\d{2}-\d{2}$/ } }),
  weightRange: c.aggregate([{ $group: { _id: null, min: { $min: '$weight' }, max: { $max: '$weight' }, distinctWeights: { $addToSet: '$weight' } } }, { $project: { min: 1, max: 1, distinctValues: { $size: '$distinctWeights' } } }]).toArray(),
}, null, 2))
