from flask import Flask, request, jsonify
import yfinance as yf
import pandas as pd
import numpy as np

app = Flask(__name__)

def compute_metrics(portfolio_df):
    # Download historical prices for tickers
    tickers = portfolio_df['symbol'].unique().tolist()
    # Download historical prices starting from earliest purchase date
    start_date = portfolio_df['date'].min()
    data = yf.download(
        tickers,
        start=start_date,
        auto_adjust=True
    )['Close']

    # Daily returns
    returns = data.pct_change().dropna()

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

    return {
        'CAGR': round(cagr, 4),
        'Volatility': round(vol, 4),
        'Sharpe': round(sharpe, 4),
        'Beta': beta
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