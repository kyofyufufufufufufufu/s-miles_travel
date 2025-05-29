from flask import Flask, request, jsonify
import os
import json
from flask_cors import CORS

app = Flask(__name__)
DATA_FILE = 'savings_data.json'
CORS(app)  # Add this line after creating the app


# Utility: Load or initialize savings data
def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, 'r') as f:
        return json.load(f)


# Utility: Save data to file
def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


# Route: Get savings data for a trip
@app.route('/savings/<trip_id>', methods=['GET'])
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
        "percent": percent
    })


# Route: Create a new savings goal
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


# Route: Update saved amount (contribution)
@app.route('/savings/<trip_id>', methods=['PATCH'])
def update_savings(trip_id):
    data = load_data()
    body = request.get_json()

    if trip_id not in data:
        return jsonify({"error": "Trip not found"}), 404

    # Update saved amount
    if 'amount' in body:
        amount = float(body['amount'])

        # Prevent negative or zero contributions
        if amount <= 0:
            return jsonify({
                "error": "Amount must be greater than 0."
            }), 400

        new_total = data[trip_id]['saved'] + amount
        goal = data[trip_id]['goal']

        if new_total > goal:
            return jsonify({
                "error": "Cannot add more than the savings goal.",
                "goal": goal,
                "attempted_total": new_total
            }), 400

        data[trip_id]['saved'] = new_total



    # Update goal (optional)
    if 'goal' in body:
        data[trip_id]['goal'] = float(body['goal'])

    save_data(data)
    return jsonify({"message": "Savings updated"}), 200

# Route: Delete savings goal
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
