import os
import shutil
import subprocess
import sys
import argparse


def remove_pycache(root='.'):
    removed = 0
    for dirpath, dirnames, filenames in os.walk(root):
        for d in list(dirnames):
            if d == '__pycache__':
                path = os.path.join(dirpath, d)
                try:
                    shutil.rmtree(path)
                    print('Removed', path)
                    removed += 1
                except Exception as e:
                    print('Failed to remove', path, e)
    if removed == 0:
        print('No __pycache__ directories found.')
    return removed


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
        print('\n--- LIBRERIAS INSTALADAS EN EL SISTEMA GLOBAL ---')
        print(result.stdout)
    except Exception as e:
        print('No se pudo obtener la lista de librerias globales:', e)
        return

    respuesta = input('Deseas eliminar las librerias mostradas en pantalla? (S/N): ').strip().upper()

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
                print('No hay librerias externas para eliminar.')
                return
            print('Eliminando librerias globales...')
            subprocess.run(
                [global_python, '-m', 'pip', 'uninstall', '-y'] + packages,
                check=True
            )
            print('Todas las librerias globales han sido eliminadas con exito.')
        except Exception as e:
            print('Ocurrio un error al intentar eliminar las librerias:', e)
    else:
        print('Operacion cancelada. No se elimino ninguna libreria.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Limpia directorios __pycache__ del proyecto.')
    parser.add_argument('--clean-only', action='store_true',
                        help='Solo elimina __pycache__, sin gestion de librerias.')
    parser.add_argument('root', nargs='?', default='.',
                        help='Directorio raiz (por defecto: directorio actual).')
    args = parser.parse_args()

    remove_pycache(args.root)

    if not args.clean_only:
        manage_global_libraries()
