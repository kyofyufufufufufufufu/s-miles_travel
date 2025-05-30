from flask import Flask, request, jsonify
import os
import json

app = Flask(__name__)
DATA_FILE = 'saved_todos.json'

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

@app.route('/todo/<trip_name>', methods=['GET'])  # 🔁 renamed from /todos
def get_tasks(trip_name):
    data = load_data()
    tasks = data.get(trip_name, [])
    return jsonify(tasks)

@app.route('/todo/<trip_name>', methods=['POST'])  # 🔁 renamed from /todos
def add_task(trip_name):
    data = load_data()
    task_text = request.json.get('task')
    if not task_text:
        return jsonify({'error': 'Task is required'}), 400

    task = {'task': task_text, 'done': False}
    data.setdefault(trip_name, []).append(task)
    save_data(data)
    return jsonify(task), 201

@app.route('/todo/<trip_name>/<int:task_index>', methods=['PATCH'])  # 🔁 renamed
def update_task(trip_name, task_index):
    data = load_data()
    if trip_name not in data or task_index >= len(data[trip_name]):
        return jsonify({'error': 'Task not found'}), 404

    task = data[trip_name][task_index]
    new_text = request.json.get('task')
    done_status = request.json.get('done')

    if new_text is not None:
        task['task'] = new_text
    if done_status is not None:
        task['done'] = done_status

    save_data(data)
    return jsonify(task)

@app.route('/todo/<trip_name>/<int:task_index>', methods=['DELETE'])  # 🔁 renamed
def delete_task(trip_name, task_index):
    data = load_data()
    if trip_name not in data or task_index >= len(data[trip_name]):
        return jsonify({'error': 'Task not found'}), 404

    removed = data[trip_name].pop(task_index)
    save_data(data)
    return jsonify(removed)

if __name__ == '__main__':
    app.run(port=3888, debug=True)
