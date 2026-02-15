# funded Strategy
#### Type <Badge type="warning" text="HF"/><Badge type="tip" text="Indicators"/>
This page documents the performance and behavior of the **funded** trading strategy, including backtesting results, key performance metrics, and trade analytics.

The data presented here is based on historical backtesting within a specified time frame and trading conditions. It is intended to provide a quantitative overview of how the strategy performs under simulated market conditions.

::: info Data
Backtest results can be downloaed here: :bar_chart:<code>[funded](https://github.com/201508876PMH/trade-bot-site/blob/master/docs/backtest_results/funded/full_backtest_report.txt)</code>
:::
## Backtest configuration
```json:line-numbers{14}
{
  "args": [
    "backtesting",
    "--config", 
      "user_data/config.json",
    "--strategy",    
      "funded",
    "--timerange",
      "20200101-",
    "--timeframe",
      //"4h",
      // "1h",
      //"30m",
      "15m",
      //"5m"
  ]
}
```

## Backtesting report

````md{8}
<!--@include: ../backtest_results/funded/backtest_report.md-->
````

## Left open trades report

```md
<!--@include: ../backtest_results/funded/left_open_trades_report.md-->
```

## Enter tag stats

```md
<!--@include: ../backtest_results/funded/enter_tags.md-->
```

## Exit reason stats

```md
<!--@include: ../backtest_results/funded/exit_tags.md-->
```
## Mixed tag stats

```md
<!--@include: ../backtest_results/funded/mixed_tags.md-->
```

## Summary metrics

```md{13}
<!--@include: ../backtest_results/funded/summary_metrics.md-->
```

## Strategy summary

```md
<!--@include: ../backtest_results/funded/strategy_summary.md-->
```