import type { JNPATerminalGeoJSON, JNPARoadGeoJSON } from './types'

/**
 * JNPA Geographic Data (GeoJSON) - SCHEMATIC ONLY
 * 
 * IMPORTANT: This data is currently APPROXIMATE and schematic.
 * As per project requirements, we need verified geographic vector data 
 * (GIS/CAD/GeoJSON) for the terminal boundaries, road centerlines, and 
 * quay edges.
 * 
 * Please provide the accurate GeoJSON data to replace this placeholder.
 */
export const jnpaTerminalGeoJSON: JNPATerminalGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'NSFT',
      properties: {
        id: 'NSFT',
        name: 'Nhava Sheva Free Port Terminal',
        source: 'GoogleEarth_Schematic',
        confidence: 'SCHEMATIC_ONLY'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[72.959, 18.962], [72.963, 18.960], [72.960, 18.954], [72.956, 18.956], [72.959, 18.962]]]
      }
    },
    {
      type: 'Feature',
      id: 'NSICT',
      properties: {
        id: 'NSICT',
        name: 'Nhava Sheva International Container Terminal',
        source: 'GoogleEarth_Schematic',
        confidence: 'SCHEMATIC_ONLY'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[72.956, 18.956], [72.960, 18.954], [72.958, 18.950], [72.954, 18.952], [72.956, 18.956]]]
      }
    },
    {
      type: 'Feature',
      id: 'NSIGT',
      properties: {
        id: 'NSIGT',
        name: 'Nhava Sheva (India) Gateway Terminal',
        source: 'GoogleEarth_Schematic',
        confidence: 'SCHEMATIC_ONLY'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[72.954, 18.952], [72.958, 18.950], [72.956, 18.947], [72.952, 18.949], [72.954, 18.952]]]
      }
    },
    {
      type: 'Feature',
      id: 'APMT',
      properties: {
        id: 'APMT',
        name: 'Gateway Terminals India',
        source: 'GoogleEarth_Schematic',
        confidence: 'SCHEMATIC_ONLY'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[72.952, 18.949], [72.956, 18.947], [72.952, 18.939], [72.948, 18.941], [72.952, 18.949]]]
      }
    },
    {
      type: 'Feature',
      id: 'BMCT',
      properties: {
        id: 'BMCT',
        name: 'Bharat Mumbai Container Terminal',
        source: 'GoogleEarth_Schematic',
        confidence: 'SCHEMATIC_ONLY'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[72.941, 18.944], [72.947, 18.940], [72.940, 18.930], [72.934, 18.934], [72.941, 18.944]]]
      }
    }
  ]
}

export const jnpaRoadsGeoJSON: JNPARoadGeoJSON = {
  type: 'FeatureCollection',
  features: []
}
