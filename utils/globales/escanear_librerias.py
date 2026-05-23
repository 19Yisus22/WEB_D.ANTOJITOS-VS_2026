import os
import re
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

def scan_used_libraries(root='.'):
    used_libs = set()
    stdlib_result = subprocess.run(
        [sys.executable, '-c', 'import sys; print(list(sys.builtin_module_names))'],
        capture_output=True, text=True
    )
    builtins = eval(stdlib_result.stdout.strip()) if stdlib_result.returncode == 0 else []

    import_regex = re.compile(r'^\s*(?:import|from)\s+([a-zA-Z0-9_]+)')

    for filename in os.listdir(root):
        if filename.endswith('.py') and filename != os.path.basename(__file__):
            try:
                with open(os.path.join(root, filename), 'r', encoding='utf-8') as f:
                    for line in f:
                        match = import_regex.match(line)
                        if match:
                            lib = match.group(1)
                            if lib not in builtins and lib != 'os' and lib != 'sys' and lib != 're' and lib != 'subprocess' and lib != 'shutil':
                                used_libs.add(lib)
            except Exception:
                pass
    
    print('\n--- LIBRERÍAS DETECTADAS EN LOS ARCHIVOS LOCALES ---')
    if used_libs:
        for lib in sorted(used_libs):
            print(f'- {lib}')
        
        try:
            with open('requirements.txt', 'w', encoding='utf-8') as req_file:
                for lib in sorted(used_libs):
                    req_file.write(f'{lib}\n')
            print('\nArchivo "requirements.txt" creado exitosamente con las librerías detectadas.')
        except Exception as e:
            print('No se pudo crear el archivo requirements.txt:', e)
    else:
        print('No se detectaron librerías externas en uso. No se generó requirements.txt.')
    print('----------------------------------------------------')

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
    scan_used_libraries('.')
    manage_global_libraries()