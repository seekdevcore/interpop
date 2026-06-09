from django.urls import path

from .views import CommentDestroyView, CommentListCreateView, CommentLikeToggleView

# O conversor 'uslug' (slug unicode, p/ slugs acentuados) é registrado uma única
# vez em ArticlesConfig.ready(). Registro é global no Django, então aqui basta
# usar <uslug:…> — sem re-registrar (evita RemovedInDjango60Warning).

urlpatterns = [
    path('articles/<uslug:slug>/comments/', CommentListCreateView.as_view(), name='comment-list'),
    path('comments/<uuid:pk>/',             CommentDestroyView.as_view(),    name='comment-delete'),
    path('comments/<uuid:pk>/like/',        CommentLikeToggleView.as_view(), name='comment-like'),
]
