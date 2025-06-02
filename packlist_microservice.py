from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from packlist_options import PACKLIST_BY_TYPE 

app = Flask(__name__)
DATA_FILE = 'packing_store.json'
CORS(app)

if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump({}, f)

def load_data():
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/packing/<trip_id>', methods=['GET'])
def get_packing_list(trip_id):
    data = load_data()
    return jsonify(data.get(trip_id, []))

@app.route('/packing/<trip_id>', methods=['POST'])
def add_packing_item(trip_id):
    item = request.json.get('item')
    if not item:
        return jsonify({'error': 'Item is required'}), 400

    data = load_data()
    if trip_id not in data:
        data[trip_id] = []

    data[trip_id].append({'item': item, 'checked': False})
    save_data(data)
    return jsonify({'message': 'Item added'}), 201

@app.route('/packing/<trip_id>/<int:item_index>', methods=['PATCH'])
def toggle_item(trip_id, item_index):
    data = load_data()

    if trip_id not in data:
        return jsonify({'error': 'Trip not found'}), 404

    try:
        item = data[trip_id][item_index]
        item['checked'] = not item.get('checked', False)
        print(f"Toggled item {item_index} in trip '{trip_id}' to {item['checked']}")
        save_data(data)
        return jsonify({'message': 'Item status toggled'}), 200
    except IndexError:
        return jsonify({'error': 'Item index out of range'}), 404

@app.route('/packing/<trip_id>/<int:item_index>', methods=['DELETE'])
def delete_item(trip_id, item_index):
    data = load_data()
    try:
        data[trip_id].pop(item_index)
        save_data(data)
        return jsonify({'message': 'Item deleted'}), 200
    except (KeyError, IndexError):
        return jsonify({'error': 'Item not found'}), 404

@app.route('/packing/options/<trip_type>', methods=['GET'])
def get_packing_options_by_type(trip_type):
    base = set(PACKLIST_BY_TYPE.get("general", []))
    extras = set(PACKLIST_BY_TYPE.get(trip_type, []))
    combined = sorted(base.union(extras))
    return jsonify(combined)

if __name__ == '__main__':
    app.run(debug=True, port=3777)
