
import json

tasks = []
current_id = 1

def save_tasks():
    with open('todo.json', 'w') as f:
        json.dump(tasks, f)

def load_tasks():
    global tasks
    try:
        with open('todo.json', 'r') as f:
            tasks = json.load(f)
    except FileNotFoundError:
        pass

load_tasks()

while True:
    command = input().strip().lower().split()
    
    if not command:
        continue
    
    cmd, *args = command
    
    if cmd == 'add':
        try:
            task = args[0]
            tasks.append({'id': current_id, 'task': task})
            print(f"Added: {task}")
            save_tasks()
            current_id += 1
        except IndexError:
            print("Add a task name.")
    
    elif cmd == 'list':
        if not tasks:
            print("No tasks.")
        else:
            for t in tasks:
                print(t['id'], t['task'])
    
    elif cmd == 'done':
        try:
            id_ = int(args[0])
            for t in tasks:
                if t['id'] == id_:
                    print(f"Marked as done: {t['task']}")
                    tasks.remove(t)
                    save_tasks()
                    break
            else:
                print("Task not found.")
        except (IndexError, ValueError):
            print("Usage: done <id>")
    
    elif cmd == 'remove':
        try:
            id_ = int(args[0])
            for i, t in enumerate(tasks):
                if t['id'] == id_:
                    print(f"Removed task: {t['task']}")
                    del tasks[i]
                    save_tasks()
                    break
            else:
                print("Task not found.")
        except (IndexError, ValueError):
            print("Usage: remove <id>")
    
    else:
        print("Unknown command. Use add, list, done <id>, or remove <id>.")