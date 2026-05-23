import os
import subprocess
import sys

def remove_pycache(root='.'):
    for dirpath, dirnames, filenames in os.walk(root):
        for d in list(dirnames):
            if d == '__pycache__':
                path = os.path.join(dirpath, d)
                try:
                    import shutil
                    shutil.rmtree(path)
                    print('Removed', path)
                except Exception as e:
                    print('Failed to remove', path, e)

def get_global_python():
    if sys.platform == 'win32':
        return 'python'
    return 'python3'

def manage_global_libraries():
    global_python = get_global_python()
    
    try:
        result = subprocess.run(
            [global_python, '-m', 'pip', 'list'],
            capture_output=True,
            text=True,
            check=True
        )
        print('\n--- LIBRERÍAS INSTALADAS EN EL SISTEMA GLOBAL ---')
        print(result.stdout)
    except Exception as e:
        print('No se pudo obtener la lista de librerías globales:', e)
        return

    respuesta = input('¿Deseas eliminar las librerías mostradas en pantalla? (S/N): ').strip().upper()
    
    if respuesta == 'S':
        try:
            packages_result = subprocess.run(
                [global_python, '-m', 'pip', 'freeze'],
                capture_output=True,
                text=True,
                check=True
            )
            lines = packages_result.stdout.splitlines()
            packages = [line.split('==')[0] for line in lines if '==' in line]
            
            if not packages:
                print('No hay librerías externas para eliminar.')
                return
                
            print('Eliminando librerías globales...')
            subprocess.run(
                [global_python, '-m', 'pip', 'uninstall', '-y'] + packages,
                check=True
            )
            print('Todas las librerías globales han sido eliminadas con éxito.')
        except Exception as e:
            print('Ocurrió un error al intentar eliminar las librerías:', e)
    else:
        print('Operación cancelada. No se eliminó ninguna librería.')

if __name__ == '__main__':
    remove_pycache('.')
    manage_global_libraries()