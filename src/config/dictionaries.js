export const DictionaryConfig = {

  projects: {
    url: "/projects/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },

  projectStatuses: {
    url: "/projectStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  projectBlocks: {
    url: "/projectBlocks/gets",
    map: (item) => ({
      id: item.id,
      label: item.name,
      project_id: item.project_id
    })
  },

  blockStages: {
    url: "/blockStages/gets",
    map: (item) => ({
      id: item.id,
      label: item.name,
      block_id: item.block_id
    })
  },
  stageSubsections: {
    url: "/stageSubsections/gets",
    map: (item) => ({
      id: item.id,
      label: item.name,
      stage_id: item.stage_id
    })
  },

  materialEstimates: {
    url: "/materialEstimates/gets",
    map: (item) => ({
      id: item.id,
      label: item.name,
      block_id: item.block_id
    })
  },

  currencies: {
    url: "/currencies/gets",
    map: (item) => ({
      id: item.id,
      label: item.name,
      code: item.code
    })
  },

  materialTypes: {
    url: "/materialTypes/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  materials: {
    url: "/materials/gets",
    map: (item) => ({
      id: item.id,
      label: item.name,
      type: item.type,
      unit_of_measure: item.unit_of_measure,
      coefficient: item.coefficient
    })
  },

  unitsOfMeasure: {
    url: "/unitsOfMeasure/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },

  serviceTypes: {
    url: "/serviceTypes/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },

  services: {
    url: "/services/gets",
    map: (item) => ({
      id: item.id,
      label: item.name,
      service_type: item.service_type,
      unit_of_measure: item.unit_of_measure
    })
  },

  materialRequestStatuses: {
    url: "/materialRequestStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  materialRequestItemStatuses: {
    url: "/materialRequestItemStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  materialWriteOffStatuses: {
    url: "/materialWriteOffStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  materialMovementStatuses: {
    url: "/materialMovementStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  warehouseTransferStatuses: {
    url: "/warehouseTransferStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },

  purchaseOrderStatuses: {
    url: "/purchaseOrderStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  purchaseOrderItemStatuses: {
    url: "/purchaseOrderItemStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },

  warehouses: {
    url: "/warehouses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name,
      project_id: item.project_id
    })
  },

  suppliers: {
    url: "/suppliers/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  contractors: {
    url: "/contractors/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },

  users: {
    url: "/users/gets",
    map: (item) => ({
      id: item.id,
      label: [item.first_name, item.last_name].filter(Boolean).join(" "),
      username: item.username,
      first_name: item.first_name,
      last_name: item.last_name,
    })
  },

  userRoles: {
    url: "/userRoles/gets",
    map: (item) => ({
      id: item.id,
      label: item.description
    })
  },

  generalStatuses: {
    url: "/generalStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  taskStatuses: {
    url: "/taskStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  taskPriorities: {
    url: "/taskPriorities/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },
  documentStatuses: {
    url: "/documentStatuses/gets",
    map: (item) => ({
      id: item.id,
      label: item.name
    })
  },



};
