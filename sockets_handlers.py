from flask import session
from flask_socketio import join_room, leave_room, disconnect
from extensions import socketio


@socketio.on("connect")
def on_connect():
    user_id = session.get("user_id")
    rol     = session.get("rol", "visitante")
    if not user_id:
        return
    join_room(f"user_{user_id}")
    join_room(f"rol_{rol}")
    if rol in ("admin", "vendedor"):
        join_room("staff")


@socketio.on("disconnect")
def on_disconnect():
    user_id = session.get("user_id")
    rol     = session.get("rol", "visitante")
    if not user_id:
        return
    leave_room(f"user_{user_id}")
    leave_room(f"rol_{rol}")
    if rol in ("admin", "vendedor"):
        leave_room("staff")


@socketio.on("ping_alive")
def on_ping():
    socketio.emit("pong_alive", {}, to=session.get("user_id") and f"user_{session['user_id']}")
