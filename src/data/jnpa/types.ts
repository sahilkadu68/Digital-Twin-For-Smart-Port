import type { FeatureCollection, Polygon, LineString } from 'geojson'

export type GISSource = 'QGIS' | 'GoogleEarth_Schematic' | 'JNPA_PDF_Schematic' | 'OSM'
export type ConfidenceLevel = 'VERIFIED' | 'APPROXIMATE' | 'SCHEMATIC_ONLY'

/**
 * Properties for JNPA Terminal Boundaries
 */
export interface TerminalGeoProperties {
  id: string
  name: string
  source: GISSource
  confidence: ConfidenceLevel
}

/**
 * Properties for JNPA Road Centerlines
 */
export interface RoadGeoProperties {
  id: string
  type: 'highway' | 'internal_corridor' | 'access_road'
  source: GISSource
  confidence: ConfidenceLevel
}

export type JNPATerminalGeoJSON = FeatureCollection<Polygon, TerminalGeoProperties>
export type JNPARoadGeoJSON = FeatureCollection<LineString, RoadGeoProperties>
