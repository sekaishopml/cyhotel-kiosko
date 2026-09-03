"""Suite BASE backend — pricing / validation / orders (stdlib unittest, sin DB).

Ejecutar desde la raiz del repo:
    python3 -m unittest discover -s backend/tests

No requiere red, docker ni PostgreSQL: todo es logica pura. Si el host no
tiene `psycopg2`, se inyecta un stub en sys.modules SOLO para poder importar
el `db.py` REAL (ROOM_TYPES / AMANECIDA_* / HOLD_MINUTES se importan del
fuente, no se copian).
"""

import os
import sys
import types
import unittest
from datetime import timedelta

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Stub de psycopg2 solo si el host no lo tiene (el CI/docker real lo trae).
# db.py lo importa a nivel de modulo pero solo conecta bajo demanda.
try:
    import psycopg2  # noqa: F401
except ImportError:
    _psycopg2 = types.ModuleType("psycopg2")
    _extras = types.ModuleType("psycopg2.extras")
    _extras.RealDictCursor = object
    _pool = types.ModuleType("psycopg2.pool")

    class ThreadedConnectionPool:  # pragma: no cover - solo stub de import
        def __init__(self, *args, **kwargs):
            raise RuntimeError("sin DB en tests")

    _pool.ThreadedConnectionPool = ThreadedConnectionPool
    _psycopg2.extras = _extras
    _psycopg2.pool = _pool

    def _no_connect(*args, **kwargs):
        raise RuntimeError("sin DB en tests")

    _psycopg2.connect = _no_connect
    sys.modules["psycopg2"] = _psycopg2
    sys.modules["psycopg2.extras"] = _extras
    sys.modules["psycopg2.pool"] = _pool

# Import REAL desde backend/db.py (fuente unica de negocio).
from db import ROOM_TYPES, AMANECIDA_ENTRY, AMANECIDA_EXIT, HOLD_MINUTES  # noqa: E402

from app.services import pricing  # noqa: E402
from app.services import validation  # noqa: E402
from app.services import orders as orders_svc  # noqa: E402


class TestDbReales(unittest.TestCase):
    """Los tests usan las constantes reales de db.py (no copias)."""

    def test_constantes_reales(self):
        self.assertEqual(HOLD_MINUTES, 30)
        self.assertEqual(AMANECIDA_ENTRY, "18:00")
        self.assertEqual(AMANECIDA_EXIT, "09:00")

    def test_room_types_reales_spot_check(self):
        self.assertEqual(ROOM_TYPES["estandar"]["momento"], 10)
        self.assertEqual(ROOM_TYPES["estandar"]["amanecida"], 20)
        self.assertEqual(ROOM_TYPES["estandar"]["hospedaje"], 30)
        self.assertEqual(ROOM_TYPES["estandar"]["extras"]["1h"]["price"], 5)
        self.assertEqual(ROOM_TYPES["estandar"]["extras"]["6h"]["price"], 20)
        self.assertEqual(ROOM_TYPES["suite"]["momento"], 20)
        self.assertEqual(ROOM_TYPES["suite"]["amanecida"], 35)
        self.assertEqual(ROOM_TYPES["suite"]["hospedaje"], 50)
        self.assertEqual(ROOM_TYPES["suite"]["amanecida_entry"], "19:00")


class TestApplyPriceOverride(unittest.TestCase):
    def test_sin_overrides_devuelve_default(self):
        self.assertEqual(pricing.apply_price_override({}, "estandar", 10), 10)

    def test_override_numerico(self):
        self.assertEqual(pricing.apply_price_override({"estandar": 15}, "estandar", 10), 15.0)

    def test_override_dict_price(self):
        self.assertEqual(
            pricing.apply_price_override({"estandar": {"price": 18}}, "estandar", 10), 18.0
        )

    def test_override_dict_price_invalido_devuelve_default(self):
        self.assertEqual(
            pricing.apply_price_override({"estandar": {"price": "no-num"}}, "estandar", 10), 10
        )

    def test_override_tipo_invalido_devuelve_default(self):
        self.assertEqual(
            pricing.apply_price_override({"estandar": "cara"}, "estandar", 10), 10
        )
        self.assertEqual(pricing.apply_price_override({"otro": 99}, "estandar", 10), 10)

    def test_extra_key_ok(self):
        ov = {"estandar": {"extras": {"1h": 7}}}
        self.assertEqual(pricing.apply_price_override(ov, "estandar", 5, extra_key="1h"), 7.0)

    def test_extra_key_ausente_devuelve_default(self):
        ov = {"estandar": {"extras": {"1h": 7}}}
        self.assertEqual(pricing.apply_price_override(ov, "estandar", 20, extra_key="6h"), 20)

    def test_extra_key_base_no_dict_devuelve_default(self):
        self.assertEqual(pricing.apply_price_override({"estandar": 99}, "estandar", 5, extra_key="1h"), 5)

    def test_extra_key_valor_string_devuelve_default(self):
        ov = {"estandar": {"extras": {"1h": "7"}}}
        self.assertEqual(pricing.apply_price_override(ov, "estandar", 5, extra_key="1h"), 5)


class TestSuiteSubtotal(unittest.TestCase):
    def test_sin_overrides_devuelve_base(self):
        self.assertEqual(pricing.suite_subtotal({}, 20, "momento"), 20.0)

    def test_dict_momento_directo(self):
        self.assertEqual(pricing.suite_subtotal({"suite": {"momento": 25}}, 20, "momento"), 25.0)

    def test_dict_extras_amanecida(self):
        ov = {"suite": {"extras": {"amanecida": 40}}}
        self.assertEqual(pricing.suite_subtotal(ov, 35, "amanecida"), 40.0)

    def test_numerico_solo_aplica_a_momento(self):
        self.assertEqual(pricing.suite_subtotal({"suite": 22}, 20, "momento"), 22.0)
        self.assertEqual(pricing.suite_subtotal({"suite": 22}, 35, "amanecida"), 35.0)

    def test_dict_price_aplica_via_override_a_momento(self):
        self.assertEqual(pricing.suite_subtotal({"suite": {"price": 26}}, 20, "momento"), 26.0)

    def test_dict_price_no_afecta_amanecida(self):
        self.assertEqual(pricing.suite_subtotal({"suite": {"price": 26}}, 35, "amanecida"), 35.0)


class TestValidateHotelConfig(unittest.TestCase):
    def test_config_vacia_ok(self):
        self.assertEqual(validation.validate_hotel_config({}), {})

    def test_no_dict_lanza(self):
        for bad in (None, [], "x", 42):
            with self.assertRaises(ValueError, msg=f"cfg={bad!r}"):
                validation.validate_hotel_config(bad)

    def test_price_overrides_debe_ser_objeto(self):
        with self.assertRaises(ValueError):
            validation.validate_hotel_config({"price_overrides": [1, 2]})

    def test_price_overrides_objeto_ok(self):
        cfg = {"price_overrides": {"estandar": 15}}
        self.assertEqual(validation.validate_hotel_config(cfg), cfg)

    def test_branding_debe_ser_objeto(self):
        with self.assertRaises(ValueError):
            validation.validate_hotel_config({"branding": "hotel"})

    def test_branding_campos_deben_ser_texto(self):
        with self.assertRaises(ValueError):
            validation.validate_hotel_config({"branding": {"hotel": 123}})
        with self.assertRaises(ValueError):
            validation.validate_hotel_config({"branding": {"tagline": None}})

    def test_branding_ok(self):
        cfg = {"branding": {"hotel": "Valle", "tagline": "descansa"}}
        self.assertEqual(validation.validate_hotel_config(cfg), cfg)

    def test_max_days_normaliza_string_a_int(self):
        self.assertEqual(validation.validate_hotel_config({"max_days": "5"})["max_days"], 5)

    def test_max_days_fuera_de_rango(self):
        for bad in (0, 31, -1):
            with self.assertRaises(ValueError, msg=f"max_days={bad}"):
                validation.validate_hotel_config({"max_days": bad})

    def test_max_days_no_entero(self):
        with self.assertRaises(ValueError):
            validation.validate_hotel_config({"max_days": "muchos"})

    def test_idle_timeout_ok_y_rangos(self):
        self.assertEqual(validation.validate_hotel_config({"idle_timeout_seconds": 60})["idle_timeout_seconds"], 60)
        for bad in (5, 601):
            with self.assertRaises(ValueError, msg=f"idle={bad}"):
                validation.validate_hotel_config({"idle_timeout_seconds": bad})

    def test_promos_debe_ser_lista(self):
        with self.assertRaises(ValueError):
            validation.validate_hotel_config({"promos": {"a": 1}})

    def test_suite_durations_debe_ser_objeto(self):
        with self.assertRaises(ValueError):
            validation.validate_hotel_config({"suite_durations": [3]})

    def test_qr_url_debe_ser_texto(self):
        with self.assertRaises(ValueError):
            validation.validate_hotel_config({"qr_url": 123})

    def test_reserva_tarifa_ok_normaliza_float(self):
        self.assertEqual(validation.validate_hotel_config({"reserva_tarifa": 25})["reserva_tarifa"], 25.0)

    def test_reserva_tarifa_fuera_de_rango(self):
        for bad in (-1, 1001, "gratis"):
            with self.assertRaises(ValueError, msg=f"tarifa={bad!r}"):
                validation.validate_hotel_config({"reserva_tarifa": bad})

    def test_assign_ttl_rango(self):
        self.assertEqual(validation.validate_hotel_config({"assign_ttl_minutes": 15})["assign_ttl_minutes"], 15)
        for bad in (4, 121):
            with self.assertRaises(ValueError, msg=f"ttl={bad}"):
                validation.validate_hotel_config({"assign_ttl_minutes": bad})

    def test_cleaning_sla_rango(self):
        self.assertEqual(validation.validate_hotel_config({"cleaning_sla_minutes": 60})["cleaning_sla_minutes"], 60)
        for bad in (5, 300, "pronto"):
            with self.assertRaises(ValueError, msg=f"sla={bad!r}"):
                validation.validate_hotel_config({"cleaning_sla_minutes": bad})


class TestValidateOrderPayload(unittest.TestCase):
    def test_momento_feliz(self):
        out = orders_svc.validate_order_payload(
            {"product": "momento", "guest_name": "Juan", "room_type": "estandar"}
        )
        self.assertEqual(out["product"], "momento")
        self.assertEqual(out["guest_name"], "Juan")
        self.assertEqual(out["room_type"], "estandar")
        self.assertIsNone(out["extra"])
        self.assertIsNone(out["id_document"])
        self.assertIsNone(out["client_ref"])

    def test_suite_feliz_con_extra(self):
        out = orders_svc.validate_order_payload(
            {"product": "suite", "guest_name": "Ana", "room_type": "suite", "extra": "amanecida"}
        )
        self.assertEqual(out["extra"], "amanecida")

    def test_suite_extra_por_defecto_momento(self):
        out = orders_svc.validate_order_payload(
            {"product": "suite", "guest_name": "Ana", "room_type": "suite"}
        )
        self.assertEqual(out["extra"], "momento")

    def test_hospedaje_feliz_con_days(self):
        out = orders_svc.validate_order_payload(
            {"product": "hospedaje", "guest_name": "Luz", "room_type": "doble", "days": 3}
        )
        self.assertEqual(out["days"], 3)

    def test_reserva_feliz(self):
        out = orders_svc.validate_order_payload(
            {"product": "reserva", "guest_name": "Rosa", "room_type": "matrimonial"}
        )
        self.assertEqual(out["product"], "reserva")

    def test_momento_extras_1h_6h_ok(self):
        for extra in ("1h", "6h"):
            out = orders_svc.validate_order_payload(
                {"product": "momento", "guest_name": "Juan", "room_type": "estandar", "extra": extra}
            )
            self.assertEqual(out["extra"], extra)

    def test_client_ref_e_id_document_opcionales(self):
        out = orders_svc.validate_order_payload(
            {
                "product": "momento",
                "guest_name": " Juan ",
                "room_type": "estandar",
                "id_document": "123",
                "client_ref": "abc",
            }
        )
        self.assertEqual(out["guest_name"], "Juan")
        self.assertEqual(out["id_document"], "123")
        self.assertEqual(out["client_ref"], "abc")

    def test_payload_no_dict(self):
        for bad in (None, [], "x"):
            with self.assertRaises(ValueError, msg=f"payload={bad!r}"):
                orders_svc.validate_order_payload(bad)

    def test_product_invalido(self):
        with self.assertRaises(ValueError):
            orders_svc.validate_order_payload(
                {"product": "spa", "guest_name": "Juan", "room_type": "estandar"}
            )

    def test_guest_name_obligatorio(self):
        with self.assertRaises(ValueError):
            orders_svc.validate_order_payload(
                {"product": "momento", "guest_name": "   ", "room_type": "estandar"}
            )

    def test_room_type_invalido(self):
        with self.assertRaises(ValueError):
            orders_svc.validate_order_payload(
                {"product": "momento", "guest_name": "Juan", "room_type": "penthouse"}
            )

    def test_suite_solo_tipo_suite(self):
        with self.assertRaises(ValueError):
            orders_svc.validate_order_payload(
                {"product": "suite", "guest_name": "Ana", "room_type": "estandar", "extra": "momento"}
            )

    def test_suite_extra_invalido(self):
        with self.assertRaises(ValueError):
            orders_svc.validate_order_payload(
                {"product": "suite", "guest_name": "Ana", "room_type": "suite", "extra": "1h"}
            )

    def test_momento_extra_invalido(self):
        with self.assertRaises(ValueError):
            orders_svc.validate_order_payload(
                {"product": "momento", "guest_name": "Juan", "room_type": "estandar", "extra": "2h"}
            )

    def test_hospedaje_days_fuera_de_rango(self):
        for bad in (0, 31):
            with self.assertRaises(ValueError, msg=f"days={bad}"):
                orders_svc.validate_order_payload(
                    {"product": "hospedaje", "guest_name": "Luz", "room_type": "doble", "days": bad}
                )

    def test_hospedaje_days_no_entero(self):
        with self.assertRaises(ValueError):
            orders_svc.validate_order_payload(
                {"product": "hospedaje", "guest_name": "Luz", "room_type": "doble", "days": "muchos"}
            )


class TestBuildOrderTimes(unittest.TestCase):
    def test_momento_base_3h(self):
        info = ROOM_TYPES["estandar"]
        ci, co, hours, subtotal = orders_svc.build_order_times("momento", "estandar", None, 1, info)
        self.assertEqual(hours, 3)
        self.assertEqual(co - ci, timedelta(hours=3))
        self.assertEqual(subtotal, 10.0)

    def test_momento_1h_suma_extra(self):
        info = ROOM_TYPES["estandar"]
        ci, co, hours, subtotal = orders_svc.build_order_times("momento", "estandar", "1h", 1, info)
        self.assertEqual(hours, 4)
        self.assertEqual(co - ci, timedelta(hours=4))
        self.assertEqual(subtotal, 15.0)  # 10 base + 5 extra

    def test_momento_6h_precio_doble_tiempo(self):
        info = ROOM_TYPES["estandar"]
        ci, co, hours, subtotal = orders_svc.build_order_times("momento", "estandar", "6h", 1, info)
        self.assertEqual(hours, 6)
        self.assertEqual(subtotal, 20.0)

    def test_momento_con_override_de_tipo(self):
        info = ROOM_TYPES["estandar"]
        _, _, _, subtotal = orders_svc.build_order_times(
            "momento", "estandar", None, 1, info, overrides={"estandar": 99}
        )
        self.assertEqual(subtotal, 99.0)

    def test_momento_extra_invalido(self):
        with self.assertRaises(ValueError):
            orders_svc.build_order_times("momento", "estandar", "2h", 1, ROOM_TYPES["estandar"])

    def test_amanecida_entry_exit_y_precio(self):
        info = ROOM_TYPES["estandar"]
        ci, co, hours, subtotal = orders_svc.build_order_times("amanecida", "estandar", None, 1, info)
        self.assertIsNone(hours)
        self.assertEqual(subtotal, 20.0)
        self.assertGreater(co, ci)

    def test_hospedaje_3_dias(self):
        info = ROOM_TYPES["doble"]
        ci, co, hours, subtotal = orders_svc.build_order_times("hospedaje", "doble", None, 3, info)
        self.assertEqual(hours, 72)
        self.assertEqual(co - ci, timedelta(days=3))
        self.assertEqual(subtotal, 120.0)  # 40 x 3

    def test_hospedaje_days_invalidos(self):
        for bad in (0, 31):
            with self.assertRaises(ValueError, msg=f"days={bad}"):
                orders_svc.build_order_times("hospedaje", "doble", None, bad, ROOM_TYPES["doble"])
        with self.assertRaises(ValueError):
            orders_svc.build_order_times("hospedaje", "doble", None, "x", ROOM_TYPES["doble"])

    def test_suite_momento_3h(self):
        info = ROOM_TYPES["suite"]
        ci, co, hours, subtotal = orders_svc.build_order_times("suite", "suite", "momento", 1, info)
        self.assertEqual(hours, 3)
        self.assertEqual(co - ci, timedelta(hours=3))
        self.assertEqual(subtotal, 20.0)

    def test_suite_amanecida(self):
        info = ROOM_TYPES["suite"]
        ci, co, hours, subtotal = orders_svc.build_order_times("suite", "suite", "amanecida", 1, info)
        self.assertIsNone(hours)
        self.assertEqual(subtotal, 35.0)
        self.assertGreater(co, ci)

    def test_suite_hospedaje_2_dias(self):
        info = ROOM_TYPES["suite"]
        ci, co, hours, subtotal = orders_svc.build_order_times("suite", "suite", "hospedaje", 2, info)
        self.assertEqual(hours, 48)
        self.assertEqual(co - ci, timedelta(days=2))
        self.assertEqual(subtotal, 100.0)  # 50 x 2

    def test_suite_con_override(self):
        info = ROOM_TYPES["suite"]
        _, _, _, subtotal = orders_svc.build_order_times(
            "suite", "suite", "momento", 1, info, overrides={"suite": {"momento": 25}}
        )
        self.assertEqual(subtotal, 25.0)

    def test_suite_otro_tipo_lanza(self):
        with self.assertRaises(ValueError):
            orders_svc.build_order_times("suite", "estandar", "momento", 1, ROOM_TYPES["estandar"])

    def test_reserva_hold_1h_subtotal_0(self):
        ci, co, hours, subtotal = orders_svc.build_order_times(
            "reserva", "estandar", None, 1, ROOM_TYPES["estandar"]
        )
        self.assertEqual(hours, 1)
        self.assertEqual(co - ci, timedelta(hours=1))
        self.assertEqual(subtotal, 0.0)

    def test_product_invalido(self):
        with self.assertRaises(ValueError):
            orders_svc.build_order_times("spa", "estandar", None, 1, ROOM_TYPES["estandar"])

    def test_doble_guard_bloquea_si_hay_otras_libres(self):
        orig = orders_svc.fetch_one
        orders_svc.fetch_one = lambda conn, sql, params=None: {"n": 2}
        try:
            with self.assertRaises(ValueError):
                orders_svc.build_order_times(
                    "momento", "doble", None, 1, ROOM_TYPES["doble"], conn=object()
                )
        finally:
            orders_svc.fetch_one = orig

    def test_doble_guard_permite_si_no_hay_otras_libres(self):
        orig = orders_svc.fetch_one
        orders_svc.fetch_one = lambda conn, sql, params=None: {"n": 0}
        try:
            _, _, hours, subtotal = orders_svc.build_order_times(
                "momento", "doble", None, 1, ROOM_TYPES["doble"], conn=object()
            )
        finally:
            orders_svc.fetch_one = orig
        self.assertEqual(hours, 3)
        self.assertEqual(subtotal, 12.0)


if __name__ == "__main__":
    unittest.main()
