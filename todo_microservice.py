from flask import Flask, request, jsonify
from flask_cors import CORS
from urllib.parse import unquote
import os, json

app = Flask(__name__)
DATA_FILE = 'saved_todos.json'
CORS(app)

# Ensure the file exists
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump({}, f)

def load_data():
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/todo/<trip_name>', methods=['GET'])
def get_tasks(trip_name):
    trip_name = unquote(trip_name)
    data = load_data()
    return jsonify(data.get(trip_name, []))

@app.route('/todo/<trip_name>', methods=['POST'])
def add_task(trip_name):
    trip_name = unquote(trip_name)
    data = load_data()

    task_text = request.json.get('task')
    if not task_text:
        return jsonify({'error': 'Task is required'}), 400

    if trip_name not in data:
        print(f"Creating new todo list for trip: '{trip_name}'")
        data[trip_name] = []

    task = {'task': task_text, 'done': False}
    data[trip_name].append(task)
    save_data(data)
    return jsonify(task), 201

@app.route('/todo/<trip_name>/<int:task_index>', methods=['PATCH'])
def toggle_task(trip_name, task_index):
    trip_name = unquote(trip_name)
    data = load_data()

    if trip_name not in data or task_index >= len(data[trip_name]):
        return jsonify({'error': 'Task not found'}), 404

    task = data[trip_name][task_index]
    task['done'] = not task.get('done', False)
    print(f"Toggled todo {task_index} in '{trip_name}' to {task['done']}")
    save_data(data)
    return jsonify({'message': 'Task status toggled'}), 200

@app.route('/todo/<trip_name>/<int:task_index>', methods=['DELETE'])
def delete_task(trip_name, task_index):
    trip_name = unquote(trip_name)
    data = load_data()
    if trip_name not in data or task_index >= len(data[trip_name]):
        return jsonify({'error': 'Task not found'}), 404

    removed = data[trip_name].pop(task_index)
    save_data(data)
    return jsonify(removed)

@app.route('/todo/<trip_name>', methods=['DELETE'])
def delete_todo_for_trip(trip_name):
    trip_name = unquote(trip_name)
    print(f"Trying to delete trip: '{trip_name}'")
    data = load_data()
    print(f"Current keys in data: {list(data.keys())}")
    if trip_name in data:
        del data[trip_name]
        save_data(data)
        return '', 204
    return jsonify({'error': 'Trip not found'}), 404

# ✅ New helper: initialize an empty list for a trip
@app.route('/todo/init/<trip_name>', methods=['POST'])
def init_todo_list(trip_name):
    trip_name = unquote(trip_name)
    data = load_data()
    if trip_name not in data:
        data[trip_name] = []
        save_data(data)
        print(f"Initialized empty todo list for '{trip_name}'")
        return jsonify({'message': f'Todo list initialized for {trip_name}'}), 201
    else:
        return jsonify({'message': f'Todo list already exists for {trip_name}'}), 200

if __name__ == '__main__':
    app.run(port=3888, debug=True)
