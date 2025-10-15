'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { useWorkspace } from '@/lib/workspaceContext'

interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string
    borderColor?: string
  }>
}

interface DashboardChartsProps {
  className?: string
}

export default function DashboardCharts({ className = '' }: DashboardChartsProps) {
  const [productsOverTime, setProductsOverTime] = useState<ChartData | null>(null)
  const [supplierPerformance, setSupplierPerformance] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const snapshotRef = useRef<string>('')
  const { activeWorkspaceId, isWorkspaceReady } = useWorkspace()

  // register chart.js components once
  useEffect(() => {
    ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)
  }, [])

  useEffect(() => {
    if (isWorkspaceReady && activeWorkspaceId) {
      fetchChartData()
    }
  }, [isWorkspaceReady, activeWorkspaceId])

  // Manual refresh trigger from dashboard page
  useEffect(() => {
    const handler = () => fetchChartData()
    window.addEventListener('dashboard:refresh', handler as any)
    return () => window.removeEventListener('dashboard:refresh', handler as any)
  }, [])

  // Do not hard-refresh on focus; charts will refresh only when user clicks Refresh (button already present in stats) or on next natural fetch

  const fetchChartData = async (retryCount = 0) => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard/charts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        // If it's a workspace error and we haven't retried too many times, retry after a delay
        if (data.error === 'No workspace selected' && retryCount < 3) {
          console.log(`Retrying dashboard charts fetch (attempt ${retryCount + 1})`)
          setTimeout(() => {
            fetchChartData(retryCount + 1)
          }, 500)
          return
        }
        throw new Error(data.error || 'Failed to load chart data')
      }

      const snapshot = JSON.stringify({
        pot: data.products_over_time?.datasets?.[0]?.data?.slice(0,3),
        spFirst3: data.supplier_performance?.labels?.slice(0,3),
        spLen: data.supplier_performance?.labels?.length || 0,
      })
      if (snapshot !== snapshotRef.current) {
        snapshotRef.current = snapshot
        setProductsOverTime(data.products_over_time)
        setSupplierPerformance(data.supplier_performance)
      }
      setError(null)
      // No continuous polling here to avoid blinking; charts will refresh on focus or manual retry
    } catch (err) {
      console.error('Error fetching chart data:', err)
      setError('Failed to load chart data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="bg-white p-6 rounded-lg shadow animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchChartData}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 dashboard-charts ${className}`}>
      {/* Products Over Time Chart */}
      <div className="bg-white p-6 rounded-lg shadow dashboard-chart dashboard-chart-products-over-time min-h-[220px]">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Products Over Time</h3>
        {productsOverTime ? (
          <div className="h-56">
            <Line
              data={{
                labels: productsOverTime.labels,
                datasets: productsOverTime.datasets.map((d) => ({
                  ...d,
                  fill: true,
                  borderColor: d.borderColor || 'rgba(37, 99, 235, 1)',
                  backgroundColor: d.backgroundColor || 'rgba(37, 99, 235, 0.1)',
                  tension: 0.3,
                  pointRadius: 3,
                })),
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.05)' } } },
              }}
            />
          </div>
        ) : (
          <div className="h-56 flex items-center justify-center text-gray-500">
            No data available
          </div>
        )}
      </div>

      {/* Supplier Performance Chart */}
      <div className="bg-white p-6 rounded-lg shadow dashboard-chart dashboard-chart-supplier-performance min-h-[220px]">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Supplier Performance <span className="text-sm text-gray-500">(Top 5)</span></h3>
        {supplierPerformance ? (
          <div className="h-56">
            <Bar
              data={{
                labels: supplierPerformance.labels,
                datasets: supplierPerformance.datasets.map((d) => ({
                  ...d,
                  borderColor: d.borderColor || 'rgba(34, 197, 94, 1)',
                  backgroundColor: d.backgroundColor || 'rgba(34, 197, 94, 0.7)',
                })),
              }}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { grid: { color: 'rgba(0,0,0,0.05)' } }, y: { grid: { display: false } } },
              }}
            />
          </div>
        ) : (
          <div className="h-56 flex items-center justify-center text-gray-500">
            No data available
          </div>
        )}
      </div>

      {/* Quick stats removed per request */}
    </div>
  )
}