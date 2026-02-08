'use client'

import { useState, useEffect } from 'react'
import { tradingAPI, type TradeSettings } from '@/lib/api'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [settings, setSettings] = useState<TradeSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const data = await tradingAPI.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleToggle = async (setting: TradeSettings) => {
    setSaving(setting.id)
    try {
      const updated = await tradingAPI.toggleEnabled(setting.id)
      setSettings(prev =>
        prev.map(s => s.id === setting.id ? updated : s)
      )
      toast.success(`${setting.name} ${updated.enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Error toggling setting:', error)
      toast.error('Failed to update setting')
    } finally {
      setSaving(null)
    }
  }

  const handleUpdate = async (setting: TradeSettings) => {
    setSaving(setting.id)
    try {
      const updated = await tradingAPI.updateSettings(setting.id, setting)
      setSettings(prev =>
        prev.map(s => s.id === setting.id ? updated : s)
      )
      toast.success(`${setting.name} updated successfully`)
    } catch (error) {
      console.error('Error updating setting:', error)
      toast.error('Failed to update setting')
    } finally {
      setSaving(null)
    }
  }

  const handleInputChange = (
    setting: TradeSettings,
    field: keyof TradeSettings,
    value: number | string
  ) => {
    const updated = { ...setting, [field]: value }
    setSettings(prev =>
      prev.map(s => s.id === setting.id ? updated : s)
    )
    // Debounce save
    setTimeout(() => handleUpdate(updated), 500)
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure trading bot parameters</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading settings...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="rounded-lg border bg-card p-6"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{setting.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {setting.name === 'default' ? 'Default trading configuration' : `${setting.name} strategy settings`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`toggle-${setting.id}`}>Enabled</Label>
                  <Switch
                    id={`toggle-${setting.id}`}
                    checked={setting.enabled}
                    onCheckedChange={() => handleToggle(setting)}
                    disabled={saving === setting.id}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor={`slippage-${setting.id}`}>
                    Max Slippage: {(setting.maxSlippage * 100).toFixed(1)}%
                  </Label>
                  <input
                    id={`slippage-${setting.id}`}
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={setting.maxSlippage * 100}
                    onChange={(e) =>
                      handleInputChange(setting, 'maxSlippage', Number(e.target.value) / 100)
                    }
                    disabled={saving === setting.id}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`positions-${setting.id}`}>
                    Max Positions: {setting.maxPositions}
                  </Label>
                  <input
                    id={`positions-${setting.id}`}
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={setting.maxPositions}
                    onChange={(e) =>
                      handleInputChange(setting, 'maxPositions', Number(e.target.value))
                    }
                    disabled={saving === setting.id}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`stoploss-${setting.id}`}>
                    Stop Loss: {(setting.stopLossPercent * 100).toFixed(0)}%
                  </Label>
                  <input
                    id={`stoploss-${setting.id}`}
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={setting.stopLossPercent * 100}
                    onChange={(e) =>
                      handleInputChange(setting, 'stopLossPercent', Number(e.target.value) / 100)
                    }
                    disabled={saving === setting.id}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`takeprofit-${setting.id}`}>
                    Take Profit: {(setting.takeProfitPercent * 100).toFixed(0)}%
                  </Label>
                  <input
                    id={`takeprofit-${setting.id}`}
                    type="range"
                    min="1"
                    max="500"
                    step="1"
                    value={setting.takeProfitPercent * 100}
                    onChange={(e) =>
                      handleInputChange(setting, 'takeProfitPercent', Number(e.target.value) / 100)
                    }
                    disabled={saving === setting.id}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`minburn-${setting.id}`}>
                    Minimum Burn Amount: {setting.minBurnAmount.toLocaleString()}
                  </Label>
                  <input
                    id={`minburn-${setting.id}`}
                    type="range"
                    min="100"
                    max="1000000"
                    step="100"
                    value={setting.minBurnAmount}
                    onChange={(e) =>
                      handleInputChange(setting, 'minBurnAmount', Number(e.target.value))
                    }
                    disabled={saving === setting.id}
                    className="w-full"
                  />
                </div>
              </div>

              {saving === setting.id && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Saving...
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <div className="mt-8 rounded-lg border bg-muted/50 p-6">
        <h3 className="font-semibold mb-3">Setting Descriptions</h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-medium text-foreground">Max Slippage</dt>
            <dd className="text-muted-foreground">Maximum acceptable price slippage when executing trades (0.1% - 10%)</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Max Positions</dt>
            <dd className="text-muted-foreground">Maximum number of concurrent open positions</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Stop Loss</dt>
            <dd className="text-muted-foreground">Percentage drop from entry price to trigger automatic sell (1% - 50%)</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Take Profit</dt>
            <dd className="text-muted-foreground">Percentage gain from entry price to trigger automatic sell (1% - 500%)</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="font-medium text-foreground">Minimum Burn Amount</dt>
            <dd className="text-muted-foreground">Minimum token burn amount to trigger a buy order (in tokens)</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
