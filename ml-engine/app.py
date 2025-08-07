from flask import Flask, request, jsonify
import yfinance as yf
import pandas as pd
import numpy as np

app = Flask(__name__)

def compute_metrics(portfolio_df):
    # Ensure date column is in datetime format
    portfolio_df['date'] = pd.to_datetime(portfolio_df['date'])
    # Download historical prices for tickers
    tickers = portfolio_df['symbol'].unique().tolist()
    # Start one year before the earliest purchase to ensure sufficient data
    start_date = (portfolio_df['date'].min() - pd.Timedelta(days=365)).strftime('%Y-%m-%d')
    data = yf.download(
        tickers,
        start=start_date,
        auto_adjust=True
    )['Close']


    # Daily returns
    returns = data.pct_change().dropna()

    # Guard against insufficient return data
    if returns.empty or returns.shape[0] < 2:
        return {'error': 'Not enough historical return data to compute metrics.'}

    # Portfolio returns based on weights
    portfolio_df['value'] = portfolio_df['shares'] * portfolio_df['purchasePrice']
    total_value = portfolio_df['value'].sum()
    # Create a Series of weights indexed by symbol
    weights = portfolio_df.set_index('symbol')['value'] / total_value
    # Compute portfolio daily returns by weighting each ticker’s returns
    port_returns = (returns * weights).sum(axis=1)

    # Metrics: CAGR
    days = (returns.index[-1] - returns.index[0]).days
    cagr = ((1 + port_returns).prod()) ** (365.0 / days) - 1
    # Volatility
    vol = port_returns.std() * np.sqrt(252)
    # Sharpe
    sharpe = (port_returns.mean() * 252) / vol

    # Skip Beta calculation for now
    beta = None

    # Compute per‐share profit percentages for multiple horizons
    horizons = {
        '1 Week': 7,
        '1 Month': 30,
        '6 Months': 182,
        '1 Year': 365
    }
    share_profits = {}
    today = data.index[-1]
    for symbol in tickers:
        series = data[symbol].dropna()
        share_profits[symbol] = {}
        for label, days in horizons.items():
            past_date = today - pd.Timedelta(days=days)
            # find the closest past price
            past_prices = series[series.index <= past_date]
            if past_prices.empty:
                share_profits[symbol][label] = None
            else:
                past_price = past_prices.iloc[-1]
                current_price = series.iloc[-1]
                share_profits[symbol][label] = round(((current_price / past_price) - 1) * 100, 2)

    return {
        'CAGR': round(cagr, 4),
        'Volatility': round(vol, 4),
        'Sharpe': round(sharpe, 4),
        'Beta': beta,
        'ShareProfits': share_profits
    }

@app.route('/metrics', methods=['POST'])
def metrics():
    payload = request.get_json()
    if not payload or 'portfolio' not in payload:
        return jsonify({'error': 'Missing portfolio data'}), 400
    df = pd.DataFrame(payload['portfolio'])
    try:
        metrics = compute_metrics(df)
        return jsonify(metrics)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)