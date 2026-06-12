import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

const ChartContext = React.createContext(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer.")
  }
  return context
}

const ChartContainer = React.forwardRef(
  ({ id, className, config, children, ...props }, ref) => {
    const uniqueId = React.useId()
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          className={cn(
            "flex aspect-video justify-center text-xs [&_.recharts-cartesian-grid-horizontal_line]:stroke-border [&_.recharts-cartesian-grid-vertical_line]:stroke-border [&_.recharts-curve.recharts-area]:fill-opacity-50 [&_.recharts-dot]:stroke-background [&_.recharts-grid-line]:stroke-border [&_.recharts-legend-item]:inline-flex [&_.recharts-legend-item]:items-center [&_.recharts-legend-item]:gap-1.5 [&_.recharts-legend-item_svg]:h-3 [&_.recharts-legend-item_svg]:w-3 [&_.recharts-legend-item_svg]:text-muted-foreground [&_.recharts-line]:stroke-width-2 [&_.recharts-pie-label-line]:stroke-border [&_.recharts-sector]:stroke-background [&_.recharts-sector]:stroke-width-2 [&_.recharts-tooltip-cursor]:fill-muted [&_.recharts-tooltip-cursor]:stroke-border [&_.recharts-tooltip-cursor]:stroke-dasharray-4 [&_.recharts-reference-line-line]:stroke-border [&_.recharts-reference-line-line]:stroke-dasharray-4",
            className
          )}
          {...props}
        >
          <ChartStyle id={chartId} config={config} />
          <RechartsPrimitive.ResponsiveContainer>
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    )
  }
)
ChartContainer.displayName = "ChartContainer"

const ChartStyle = ({ id, config }) => {
  const colorConfig = Object.entries(config).filter(
    ([_, config]) => config.color
  )

  if (colorConfig.length === 0) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
        ${colorConfig
          .map(([key, config]) => `
            :root {
              --color-${key}: ${config.color};
            }
          `)
          .join("\n")}
      `,
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      hideLabel = false,
      hideIndicator = false,
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${item.dataKey || item.name || "value"}`
      const itemConfig = config[key]
      const value =
        itemConfig?.label ||
        (labelFormatter ? labelFormatter(label, payload) : label)

      if (!value) {
        return null
      }

      return (
        <div className={cn("font-medium", labelClassName)}>{value}</div>
      )
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config])

    if (!active || !payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {tooltipLabel}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${item.dataKey || item.name || "value"}`
            const itemConfig = config[key]
            const name = itemConfig?.label || item.name
            const value = formatter ? formatter(item.value, item.name, item, index) : item.value

            return (
              <div
                key={item.dataKey || index}
                className={cn(
                  "flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {!hideIndicator && (
                  <div
                    className={cn(
                      "shrink-0 rounded-[2px] border-[1.5px]",
                      indicator === "dot"
                        ? "h-2 w-2 rounded-full"
                        : "w-1",
                      indicator === "line" && "w-1"
                    )}
                    style={{
                      backgroundColor: item.color || item.payload?.color || itemConfig?.color,
                      borderColor: item.color || item.payload?.color || itemConfig?.color,
                    }}
                  />
                )}
                <div className="flex flex-1 justify-between leading-none">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-mono font-medium text-foreground">
                    {value}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef(
  ({ className, payload, verticalAlign = "bottom", nameKey }, ref) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = config[key]

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
            >
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: item.color || itemConfig?.color,
                }}
              />
              <span className="text-muted-foreground">{itemConfig?.label || item.value}</span>
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegendContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}
