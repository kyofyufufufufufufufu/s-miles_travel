from flask import Flask, request, jsonify
from flask_cors import CORS
import os, json

app = Flask(__name__)
DATA_FILE = 'saved_todos.json'
CORS(app)  # ✅ Allow cross-origin requests

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
    data = load_data()
    return jsonify(data.get(trip_name, []))

@app.route('/todo/<trip_name>', methods=['POST'])
def add_task(trip_name):
    data = load_data()
    task_text = request.json.get('task')
    if not task_text:
        return jsonify({'error': 'Task is required'}), 400

    task = {'task': task_text, 'done': False}
    data.setdefault(trip_name, []).append(task)
    save_data(data)
    return jsonify(task), 201

@app.route('/todo/<trip_name>/<int:task_index>', methods=['PATCH'])
def toggle_task(trip_name, task_index):
    data = load_data()

    if trip_name not in data or task_index >= len(data[trip_name]):
        return jsonify({'error': 'Task not found'}), 404

    try:
        task = data[trip_name][task_index]
        task['done'] = not task.get('done', False)  # ✅ Toggle it like packing
        print(f"Toggled todo {task_index} in '{trip_name}' to {task['done']}")
        save_data(data)
        return jsonify({'message': 'Task status toggled'}), 200
    except IndexError:
        return jsonify({'error': 'Task index out of range'}), 404

@app.route('/todo/<trip_name>/<int:task_index>', methods=['DELETE'])
def delete_task(trip_name, task_index):
    data = load_data()
    if trip_name not in data or task_index >= len(data[trip_name]):
        return jsonify({'error': 'Task not found'}), 404

    removed = data[trip_name].pop(task_index)
    save_data(data)
    return jsonify(removed)

if __name__ == '__main__':
    app.run(port=3888, debug=True)