from flask import Flask, request, jsonify
import os
import json
from flask_cors import CORS

app = Flask(__name__)
DATA_FILE = 'savings_data.json'
CORS(app)

def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


# Get savings data for a trip
@app.route('/savings/<trip_id>', methods=['GET'])
def get_savings(trip_id):
    data = load_data()
    trip = data.get(trip_id)
    if not trip:
        return jsonify({"error": "Trip not found"}), 404

    goal = trip['goal']
    saved = trip['saved']
    percent = int((saved / goal) * 100) if goal > 0 else 0

    return jsonify({
        "goal": goal,
        "saved": saved,
        "percent": percent,
        "celebrated": trip.get("celebrated", False)
    })

# Create a new savings goal
@app.route('/savings', methods=['POST'])
def create_savings():
    data = load_data()
    body = request.get_json()

    trip_id = str(body.get('trip_id'))
    goal = body.get('goal')

    if not trip_id or goal is None:
        return jsonify({"error": "trip_id and goal required"}), 400

    data[trip_id] = {
        "goal": float(goal),
        "saved": 0.0
    }
    save_data(data)

    return jsonify({"message": "Savings goal created"}), 201

# Update saved amount
@app.route('/savings/<trip_id>', methods=['PATCH'])
def update_savings(trip_id):
    data = load_data()
    body = request.get_json()

    if trip_id not in data:
        return jsonify({"error": "Trip not found"}), 404

    trip = data[trip_id]

    # Update saved amount
    if 'amount' in body:
        amount = float(body['amount'])
        if amount <= 0:
            return jsonify({"error": "Amount must be greater than 0."}), 400

        trip['saved'] += amount

    # Update goal
    if 'goal' in body:
        trip['goal'] = float(body['goal'])

    goal = trip['goal']
    saved = trip['saved']
    if saved >= goal and not trip.get('celebrated'):
        trip['celebrated'] = True

    save_data(data)
    return jsonify({"message": "Savings updated"}), 200

# Delete goal
@app.route('/savings/<trip_id>', methods=['DELETE'])
def delete_savings(trip_id):
    data = load_data()

    if trip_id not in data:
        return jsonify({"error": "Trip not found"}), 404

    del data[trip_id]
    save_data(data)

    return jsonify({"message": "Savings goal deleted"}), 200


if __name__ == '__main__':
    app.run(port=3760, debug=True)
