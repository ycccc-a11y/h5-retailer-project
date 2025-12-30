import pymysql
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os

# 数据库配置（连接到 TiDB Cloud）
DB_CONFIG = {
    'host': 'gateway01.us-west-2.prod.aws.tidbcloud.com',
    'port': 4000,
    'user': '3HMtcKN9jJhR99t.root',
    'password': '1Ufugqc0Bt0OqbSW',
    'database': 'locationnt',
    'ssl': {'ca': '/etc/ssl/certs/ca-certificates.crt'},
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

def get_db_connection():
    try:
        return pymysql.connect(**DB_CONFIG)
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query = parse_qs(parsed_path.query)
        
        # 许可证查询接口: /api/search/license/{number}
        if path.startswith('/api/search/license/'):
            license_number = path.split('/')[-1]
            result, status = self.search_license(license_number)
            self.send_response_data(result, status)
        # 分页查询所有许可证: /api/licenses?page=1&page_size=20
        elif path == '/api/licenses':
            page = int(query.get('page', [1])[0])
            page_size = int(query.get('page_size', [20])[0])
            result, status = self.get_all_licenses(page, page_size)
            self.send_response_data(result, status)
        else:
            self.send_response_data({'error': 'Not Found', 'path': path}, 404)

    def do_POST(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # 路径规划接口: /api/plan/route
        if path == '/api/plan/route':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data)
            # 这里可以调用原有的路径规划逻辑，为了演示先返回模拟成功
            self.send_response_data({'message': 'Route planning received', 'data': payload}, 200)
        else:
            self.send_response_data({'error': 'Not Found'}, 404)

    def search_license(self, license_number):
        conn = get_db_connection()
        if not conn:
            return {'error': 'Database connection failed'}, 500
        try:
            with conn.cursor() as cursor:
                sql = "SELECT `许可证号`, `客户名称`, `经营地址`, `经度`, `维度` FROM retailers WHERE `许可证号` = %s"
                cursor.execute(sql, (license_number,))
                result = cursor.fetchone()
                if result:
                    return result, 200
                else:
                    return {'error': 'License not found'}, 404
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            conn.close()

    def get_all_licenses(self, page, page_size):
        conn = get_db_connection()
        if not conn:
            return {'error': 'Database connection failed'}, 500
        try:
            with conn.cursor() as cursor:
                offset = (page - 1) * page_size
                sql = "SELECT `许可证号`, `客户名称`, `经营地址`, `经度`, `维度` FROM retailers LIMIT %s OFFSET %s"
                cursor.execute(sql, (page_size, offset))
                results = cursor.fetchall()
                
                cursor.execute("SELECT COUNT(*) as total FROM retailers")
                total = cursor.fetchone()['total']
                
                return {
                    'data': results,
                    'total': total,
                    'page': page,
                    'page_size': page_size
                }, 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            conn.close()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_response_data(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
