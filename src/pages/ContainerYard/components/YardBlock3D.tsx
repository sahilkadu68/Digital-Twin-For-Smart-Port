import { Text } from '@react-three/drei'

interface YardBlock3DProps {
  block: string
  width: number
  depth: number
  x: number
  z: number
}

export default function YardBlock3D({
  block,
  width,
  depth,
  x,
  z,
}: YardBlock3DProps) {
  return (
    <group position={[x, 0, z]}>
      
      {/* Concrete Pad */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[width + 0.5, 0.05, depth + 0.5]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* RTG Rails (Left & Right of the block) */}
      <mesh position={[-width / 2 - 0.2, 0.1, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.02, depth + 1]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[width / 2 + 0.2, 0.1, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.02, depth + 1]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Internal Driving Aisle (Front) */}
      <mesh position={[0, 0.07, depth / 2 + 1.5]} receiveShadow>
        <boxGeometry args={[width + 2, 0.04, 2.5]} />
        <meshStandardMaterial color="#334155" roughness={0.95} />
      </mesh>

      {/* Yellow lane markings on the aisle */}
      <mesh position={[0, 0.091, depth / 2 + 1.5]} receiveShadow>
        <boxGeometry args={[width, 0.01, 0.1]} />
        <meshStandardMaterial color="#eab308" />
      </mesh>

      {/* Block Label Billboard */}
      <group position={[0, 0, -depth / 2 - 1]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[2, 0.8, 0.2]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <Text
          position={[0, 0.5, 0.11]}
          fontSize={0.4}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
        >
          {block}
        </Text>
      </group>

    </group>
  )
}
