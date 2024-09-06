'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Laptop, Monitor, X, Zap, Server, HelpCircle } from "lucide-react"

type OS = 'OS1' | 'OS2' | 'DHCP' | null

type VM = {
  id: number
  name: string
  os: OS
  mac: string
  isDHCP?: boolean
  ip?: string
}

type PacketType = 'DHCP Discover' | 'DHCP Offer' | 'DHCP Request' | 'DHCP Acknowledge' | 'ICMP Request' | 'ICMP Reply'

type Packet = {
  id: number
  from: number
  to: number
  type: PacketType
  data: string
}

type Position = {
  x: number
  y: number
}

export function NetworkSimulator() {
  const [vms, setVms] = useState<VM[]>([]);
  const [nextId, setNextId] = useState(1)
  const [packets, setPackets] = useState<Packet[]>([])
  const [selectedVM, setSelectedVM] = useState<number | null>(null)
  const [targetVM, setTargetVM] = useState<number | null>(null)
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const vmRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})
  const packetListRef = useRef<HTMLDivElement>(null)
  const zapRefs = useRef<{ [key: string]: SVGSVGElement | null }>({})
  const [dhcpIp, setDhcpIp] = useState(11)

  const generateMACAddress = () => {
    return Array.from({length: 6}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':');
  }

  useEffect(() => {
    if (vms.length) return
    setVms([
      { id: 0, name: "DHCP Server", os: 'DHCP', mac: generateMACAddress(), isDHCP: true, ip: '192.168.1.1' }
    ])
  }, [vms])

  const addVM = () => {
    const newVM = { id: nextId, name: `VM${nextId}`, os: null, mac: generateMACAddress() }
    setVms([...vms, newVM])
    setNextId(nextId + 1)
  }

  const removeVM = (id: number) => {
    setVms(vms.filter(vm => vm.isDHCP || vm.id !== id))
    if (selectedVM === id) setSelectedVM(null)
    if (targetVM === id) setTargetVM(null)
  }

  const updateVMOS = async (id: number, os: OS) => {
    setVms(prevVms => prevVms.map(vm => vm.id === id ? { ...vm, os } : vm))

    if (os !== null && os !== 'DHCP') {
      await runDHCPProcess(id)
    } else {
      setVms(prevVms => prevVms.map(vm => vm.id === id ? { ...vm, ip: undefined } : vm))
    }
  }

  const OSIcon = ({ os }: { os: OS }) => {
    switch (os) {
      case 'OS1':
        return <Laptop className="h-6 w-6 text-blue-500" />
      case 'OS2':
        return <Monitor className="h-6 w-6 text-green-500" />
      case 'DHCP':
        return <Server className="h-6 w-6 text-purple-500" />
      default:
        return <HelpCircle className="h-6 w-6 text-gray-400" />
    }
  }

  const getVMPosition = (vmId: number): Position | null => {
    const vmElement = vmRefs.current[vmId]
    if (!vmElement) return null

    const iconElement = vmElement.querySelector('svg.h-6.w-6')
    const r = (iconElement ? iconElement : vmElement).getBoundingClientRect()
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2
    }
  }

  const animateElement = async (
    element: SVGSVGElement,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration: number
  ) => {
    const startTime = performance.now()
    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime
      const progress = Math.min(elapsedTime / duration, 1)
      const easeProgress = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2 // Cubic easing

      const r = element.getBoundingClientRect()
      const currentX = startX + (endX - startX) * easeProgress - r.width  / 2
      const currentY = startY + (endY - startY) * easeProgress - r.height / 2

      element.style.transform = `translate(${currentX}px, ${currentY}px)`

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)

    return new Promise<void>((resolve) => {
      setTimeout(resolve, duration)
    })
  }

  const generateRandomHexDump = (type: PacketType) => {
    const hexChars = '0123456789ABCDEF'
    let result = `${type}\n`
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        result += hexChars[Math.floor(Math.random() * 16)]
        result += hexChars[Math.floor(Math.random() * 16)]
        result += ' '
      }
      result += '\n'
    }
    return result
  }

  const sendPacket = async (from: number, to: number | null, type: PacketType) => {
    const packet = { 
      id: Date.now(),
      from,
      to: to ?? -1,
      type,
      data: generateRandomHexDump(type)
    }
    setPackets(prev => [...prev, packet])

    const fromPosition = getVMPosition(from)
    if (!fromPosition) return

    if (to === null) {
      // Broadcast
      const promises = vms.filter(vm => vm.id !== from && vm.os !== null).map(vm => {
        const toPosition = getVMPosition(vm.id)
        if (!toPosition) return Promise.resolve()

        const zapRef = zapRefs.current[`zap-${from}-${vm.id}`]
        if (!zapRef) return Promise.resolve()

        zapRef.style.display = 'block'
        zapRef.classList.remove('text-green-400', 'text-yellow-400', 'text-blue-400', 'text-purple-400')
        zapRef.classList.add(getPacketColor(type))

        return animateElement(zapRef, fromPosition.x, fromPosition.y, toPosition.x, toPosition.y, 1000)
          .then(() => {
            zapRef.style.display = 'none'
          })
      })

      await Promise.all(promises)
    } else {
      const toPosition = getVMPosition(to)
      if (!toPosition) return

      const zapRef = zapRefs.current[`zap-${from}-${to}`]
      if (!zapRef) return

      zapRef.style.display = 'block'
      zapRef.classList.remove('text-green-400', 'text-yellow-400', 'text-blue-400', 'text-purple-400')
      zapRef.classList.add(getPacketColor(type))

      await animateElement(zapRef, fromPosition.x, fromPosition.y, toPosition.x, toPosition.y, 1000)
      zapRef.style.display = 'none'
    }
  }

  const getPacketColor = (type: PacketType) => {
    switch (type) {
      case 'DHCP Discover':
      case 'DHCP Request':
        return 'text-blue-400'
      case 'DHCP Offer':
      case 'DHCP Acknowledge':
        return 'text-purple-400'
      case 'ICMP Request':
        return 'text-yellow-400'
      case 'ICMP Reply':
        return 'text-green-400'
      default:
        return 'text-gray-400'
    }
  }

  const runDHCPProcess = async (vmId: number) => {
    const dhcpServer = vms.find(vm => vm.isDHCP)
    if (!dhcpServer) return

    // DHCP Discover (broadcast)
    await sendPacket(vmId, null, 'DHCP Discover')

    // DHCP Offer
    await sendPacket(dhcpServer.id, vmId, 'DHCP Offer')

    // DHCP Request (unicast to DHCP server)
    await sendPacket(vmId, dhcpServer.id, 'DHCP Request')

    // DHCP Acknowledge
    await sendPacket(dhcpServer.id, vmId, 'DHCP Acknowledge')

    // Assign IP address
    const newIp = `192.168.1.${dhcpIp}`
    setVms(prevVms => prevVms.map(vm => vm.id === vmId ? { ...vm, ip: newIp } : vm))
    setDhcpIp(prevIp => {
      const nextIp = prevIp + 1
      return nextIp > 254 ? 11 : nextIp
    })
  }

  const sendPing = async () => {
    if (selectedVM !== null && targetVM !== null) {
      await sendPacket(selectedVM, targetVM, 'ICMP Request')
      await sendPacket(targetVM, selectedVM, 'ICMP Reply')
    }
  }

  useEffect(() => {
    if (packetListRef.current) {
      packetListRef.current.scrollTop = packetListRef.current.scrollHeight
    }
  }, [packets])

  return (
    <div className="flex flex-col h-screen" ref={containerRef}>
      <div className="flex-1 overflow-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Network Simulator</h1>
        <Button onClick={addVM} className="mb-4">Add Virtual Machine</Button>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8 relative">
          {vms.map(vm => (
            <Card key={vm.id} className="p-2" ref={el => {
              if (el) {
                vmRefs.current[vm.id] = el
              } else {
                delete vmRefs.current[vm.id]
              }
            }}>
              <CardContent className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{vm.name}</span>
                  {!vm.isDHCP && (
                    <Button variant="ghost" size="icon" onClick={() => removeVM(vm.id)} className="h-6 w-6 p-0">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <OSIcon os={vm.os} />
                  {!vm.isDHCP && (
                    vm.os ? (
                      <span className="text-sm font-medium">{vm.os}</span>
                    ) : (
                      <Select
                        value={vm.os || ''}
                        onValueChange={(value) => updateVMOS(vm.id, value as OS)}
                      >
                        <SelectTrigger className="w-16 h-8">
                          <SelectValue placeholder="OS" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OS1">OS1</SelectItem>
                          <SelectItem value="OS2">OS2</SelectItem>
                        </SelectContent>
                      </Select>
                    )
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  MAC: {vm.mac}
                  {vm.ip && (
                    <span><br />IP: {vm.ip}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {vms.map(fromVM => 
            vms.map(toVM => 
              fromVM.id !== toVM.id && (
                <Zap
                  key={`zap-${fromVM.id}-${toVM.id}`}
                  ref={el => {
                    if (el) {
                      zapRefs.current[`zap-${fromVM.id}-${toVM.id}`] = el
                    } else {
                      delete zapRefs.current[`zap-${fromVM.id}-${toVM.id}`]
                    }
                  }}
                  className="fixed text-yellow-400"
                  style={{
                    left: 0,
                    top: 0,
                    transform: 'translate(0px, 0px)',
                    display: 'none',
                  }}
                />
              )
            )
          )}
        </div>
      </div>
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <Select
            value={selectedVM?.toString() || ''}
            onValueChange={(value) => setSelectedVM(Number(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select source VM" />
            </SelectTrigger>
            <SelectContent>
              {vms.filter(vm => vm.os !== null && vm.os !== 'DHCP').map(vm => (
                <SelectItem key={vm.id} value={vm.id.toString()}>{vm.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>→</span>
          <Select
            value={targetVM?.toString() || ''}
            onValueChange={(value) => setTargetVM(Number(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select target VM" />
            </SelectTrigger>
            <SelectContent>
              {vms.filter(vm => vm.id !== selectedVM && vm.os !== null).map(vm => (
                <SelectItem key={vm.id} value={vm.id.toString()}>{vm.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={sendPing} disabled={selectedVM === null || targetVM === null}>
            Ping
          </Button>
        </div>
      </div>
      <div className="h-1/3 bg-gray-100 p-4 flex">
        <div className="w-1/2 pr-2 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Network Packets</h2>
          <div ref={packetListRef} className="flex-1 overflow-auto space-y-2 bg-white">
            {packets.map((packet) => (
              <div
                key={packet.id}
                className={`${getPacketColor(packet.type)} px-2 rounded text-sm cursor-pointer leading-tight font-bold ${selectedPacket?.id === packet.id ? 'bg-gray-200' : ''}`}
                onClick={() => setSelectedPacket(packet)}
              >
                {packet.type}: {vms.find(vm => vm.id === packet.from)?.name} → {packet.to === -1 ? 'Broadcast' : vms.find(vm => vm.id === packet.to)?.name}
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2 pl-2 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Packet Hex Dump</h2>
          <div className="flex-1 overflow-auto bg-white p-2 rounded">
            {selectedPacket ? (
              <pre className="text-xs font-mono">{selectedPacket.data}</pre>
            ) : (
              <p className="text-gray-500">Select a packet to view its hex dump</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
